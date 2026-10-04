/* Deutsch Master - Cloud Sync Module
   Local-first synchronization with Supabase
   Features: offline queue, conflict resolution, deterministic merge, retry logic
*/
"use strict";

const CloudSync = (function () {
    "use strict";

    let supabaseClient = null;
    let syncState = {
        status: "idle", // idle, syncing, online, offline, error
        lastSync: null,
        pendingCount: 0,
        error: null
    };
    let syncCallbacks = [];
    let retryTimer = null;
    let isOnline = navigator.onLine;
    let syncInterval = null;
    let currentVersion = 0;

    // Active-account binding: every cloud read/write is stamped with the user
    // id that was active when it started, and re-validated after each await.
    // app-init sets this on every auth transition (including sign-out -> null).
    // A stale in-flight operation (sign-out / account switch mid-flight) aborts
    // instead of writing one account's data under another account.
    let activeUserId = null;
    let syncGeneration = 0;
    function setActiveUser(userId) {
        activeUserId = userId || null;
        syncGeneration++;
        return syncGeneration;
    }
    function getActiveUser() { return activeUserId; }
    function checkActive(userId, generation) {
        return !!userId && userId === activeUserId &&
            (generation === undefined || generation === syncGeneration);
    }

    // Sync status constants
    const SYNC_STATUS = {
        IDLE: "idle",
        SYNCING: "syncing",
        ONLINE: "online",
        OFFLINE: "offline",
        ERROR: "error"
    };

    // Initialize with Supabase client
    function init(client) {
        supabaseClient = client;
        setupNetworkListeners();
        loadPendingQueue();
        return this;
    }

    // Register status change callback
    function onStatusChange(callback) {
        syncCallbacks.push(callback);
        // Immediately call with current state
        try { callback(syncState); } catch (e) {}
        return () => {
            syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
        };
    }

    // Notify all callbacks
    function notifyStatusChange() {
        syncCallbacks.forEach(cb => {
            try { cb(syncState); } catch (e) {}
        });
    }

    // Update sync status
    function setStatus(status, extra = {}) {
        syncState = { ...syncState, status, ...extra };
        notifyStatusChange();
        updateSyncIndicator();
    }

    // Setup online/offline listeners
    function setupNetworkListeners() {
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
    }

    function handleOnline() {
        isOnline = true;
        console.log("[Sync] Network online - triggering sync");
        setStatus(SYNC_STATUS.ONLINE);
        processQueue();
    }

    function handleOffline() {
        isOnline = false;
        console.log("[Sync] Network offline");
        setStatus(SYNC_STATUS.OFFLINE, { error: "working offline" });
    }

    // ==================== SYNC INDICATOR ====================

    function updateSyncIndicator() {
        const indicator = document.getElementById("syncIndicator");
        if (!indicator) return;

        const status = syncState.status;
        const pending = syncState.pendingCount;

        indicator.className = "sync-indicator " + status;

        const t = window.t || ((k) => k);
        const labels = {
            [SYNC_STATUS.IDLE]: t("sync_ready"),
            [SYNC_STATUS.SYNCING]: t("sync_syncing"),
            [SYNC_STATUS.ONLINE]: t("sync_online"),
            [SYNC_STATUS.OFFLINE]: t("sync_offline"),
            [SYNC_STATUS.ERROR]: t("sync_error")
        };

        const label = labels[status] || t("sync_ready");
        indicator.textContent = pending > 0 ? `${label} (${pending})` : label;
        indicator.title = t("sync_status_title");
    }

    // ==================== VERSION & STATE ====================

    // Local state version travels with the ACTIVE identity snapshot
    // (guest key or per-account key via DMIdentity), never a global counter.
    function activeStoreKey() {
        try {
            if (window.DMIdentity && typeof window.DMIdentity.activeKey === "function") {
                return window.DMIdentity.activeKey();
            }
        } catch (e) {}
        return "deutsch_master_v2";
    }

    // Get local state version
    function getLocalVersion() {
        try {
            const raw = localStorage.getItem(activeStoreKey());
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed._syncVersion || 0;
            }
        } catch (e) {}
        return 0;
    }

    // Set local state version
    function setLocalVersion(version) {
        try {
            const raw = localStorage.getItem(activeStoreKey());
            if (raw) {
                const parsed = JSON.parse(raw);
                parsed._syncVersion = version;
                localStorage.setItem(activeStoreKey(), JSON.stringify(parsed));
            }
        } catch (e) {}
    }

    // Get cloud state version
    async function getCloudVersion(userId) {
        if (!supabaseClient) return 0;
        try {
            const { data, error } = await supabaseClient
                .from("user_progress")
                .select("version")
                .eq("user_id", userId)
                .single();

            if (error && error.code !== "PGRST116") throw error;
            return data?.version || 0;
        } catch (e) {
            console.warn("[Sync] Get cloud version failed:", e);
            return 0;
        }
    }

    // ==================== MAIN SYNC OPERATIONS ====================

    // Full sync: upload local + download cloud + merge
    async function fullSync(userId, localState) {
        if (!supabaseClient || !userId) {
            return { success: false, error: "Not initialized" };
        }
        if (!checkActive(userId)) {
            return { success: false, error: "Superseded: account changed" };
        }

        if (!isOnline) {
            return { success: false, error: "Offline", queued: true };
        }

        setStatus(SYNC_STATUS.SYNCING);
        const generation = syncGeneration;

        try {
            // 1. Get cloud state
            const { data: cloudData, error: fetchError } = await supabaseClient
                .from("user_progress")
                .select("state, version, updated_at")
                .eq("user_id", userId)
                .single();

            if (!checkActive(userId, generation)) {
                return { success: false, error: "Superseded: account changed" };
            }

            if (fetchError && fetchError.code !== "PGRST116") {
                throw fetchError;
            }

            const cloudState = cloudData?.state || {};
            const cloudVersion = cloudData?.version || 0;
            const localVersion = getLocalVersion();

            console.log("[Sync] Versions - Local:", localVersion, "Cloud:", cloudVersion);

            // 2. Determine sync strategy
            let mergedState;
            let newVersion;

            if (!cloudData || Object.keys(cloudState).length === 0) {
                // Case A: Cloud empty, upload local
                console.log("[Sync] Cloud empty - uploading local state");
                mergedState = localState;
                newVersion = localVersion + 1 || 1;
            } else if (localVersion === 0) {
                // Case B: Local empty, download cloud
                console.log("[Sync] Local empty - downloading cloud state");
                mergedState = cloudState;
                newVersion = cloudVersion;
            } else {
                // Case C: Both have data - merge
                console.log("[Sync] Both have data - merging");
                const mergeResult = mergeStates(localState, cloudState, localVersion, cloudVersion);
                mergedState = mergeResult.state;
                newVersion = Math.max(localVersion, cloudVersion) + 1;
            }

            // 3. Upload merged state
            if (!checkActive(userId, generation)) {
                return { success: false, error: "Superseded: account changed" };
            }
            const { error: upsertError } = await supabaseClient
                .from("user_progress")
                .upsert({
                    user_id: userId,
                    state: mergedState,
                    version: newVersion,
                    device_id: window.AuthModule?.getDeviceId?.(),
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id" });

            if (upsertError) throw upsertError;

            if (!checkActive(userId, generation)) {
                return { success: false, error: "Superseded: account changed" };
            }
            // 4. Apply merged state locally
            applyMergedState(mergedState);
            setLocalVersion(newVersion);
            currentVersion = newVersion;

            // 5. Process pending queue
            await processQueue();

            setStatus(SYNC_STATUS.ONLINE, { lastSync: new Date().toISOString(), pendingCount: 0 });
            console.log("[Sync] Full sync completed, version:", newVersion);

            return { success: true, version: newVersion };

        } catch (e) {
            console.error("[Sync] Full sync failed:", e);
            setStatus(SYNC_STATUS.ERROR, { error: e.message });
            return { success: false, error: e.message };
        }
    }

    // Upload local changes only (incremental)
    // Read-before-write: if the cloud holds a NEWER version than this device,
    // merge first so we never silently overwrite newer progress with older data.
    async function uploadChanges(userId, localState) {
        if (!supabaseClient || !userId || !isOnline) {
            return queueOperation("upsert_progress", { state: localState }, userId || null);
        }
        if (!checkActive(userId)) {
            return { success: false, error: "Superseded: account changed" };
        }
        const generation = syncGeneration;

        try {
            const localVersion = getLocalVersion();
            let stateToUpload = localState;
            let version = localVersion + 1;

            try {
                const { data: cloudRow, error: cloudError } = await supabaseClient
                    .from("user_progress")
                    .select("state, version")
                    .eq("user_id", userId)
                    .single();
                if (!checkActive(userId, generation)) {
                    return { success: false, error: "Superseded: account changed" };
                }
                if (!cloudError && cloudRow && (cloudRow.version || 0) > localVersion) {
                    // Cloud is newer - deterministic merge, then upload merged state
                    const merged = mergeStates(localState, cloudRow.state || {}, localVersion, cloudRow.version || 0);
                    stateToUpload = merged.state;
                    version = (cloudRow.version || 0) + 1;
                    applyMergedState(stateToUpload);
                }
            } catch (e) {
                if (e && e.message === "Superseded: account changed") {
                    return { success: false, error: e.message };
                }
                // Version pre-check is best-effort; fall through to plain upload
                console.warn("[Sync] Cloud version pre-check failed, uploading local:", e);
            }

            if (!checkActive(userId, generation)) {
                return { success: false, error: "Superseded: account changed" };
            }
            const { error } = await supabaseClient
                .from("user_progress")
                .upsert({
                    user_id: userId,
                    state: stateToUpload,
                    version,
                    device_id: window.AuthModule?.getDeviceId?.(),
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id" });

            if (error) throw error;

            if (!checkActive(userId, generation)) {
                return { success: false, error: "Superseded: account changed" };
            }
            setLocalVersion(version);
            currentVersion = version;
            setStatus(SYNC_STATUS.ONLINE, { lastSync: new Date().toISOString() });
            return { success: true, version };

        } catch (e) {
            console.warn("[Sync] Upload failed, queuing:", e);
            return queueOperation("upsert_progress", { state: localState }, userId || null);
        }
    }

    // Download cloud state
    async function downloadState(userId) {
        if (!supabaseClient || !userId || !isOnline) {
            return { success: false, error: "Offline or not initialized" };
        }
        if (!checkActive(userId)) {
            return { success: false, error: "Superseded: account changed" };
        }

        try {
            const { data, error } = await supabaseClient
                .from("user_progress")
                .select("state, version")
                .eq("user_id", userId)
                .single();

            if (error && error.code !== "PGRST116") throw error;

            if (data) {
                applyMergedState(data.state);
                setLocalVersion(data.version);
                currentVersion = data.version;
                setStatus(SYNC_STATUS.ONLINE, { lastSync: new Date().toISOString() });
                return { success: true, state: data.state, version: data.version };
            }

            return { success: false, error: "No cloud data" };

        } catch (e) {
            console.error("[Sync] Download failed:", e);
            return { success: false, error: e.message };
        }
    }

    // ==================== MERGE LOGIC ====================

    // Deterministic merge of local and cloud states
    function mergeStates(localState, cloudState, localVersion, cloudVersion) {
        console.log("[Sync] Merging states - local v" + localVersion + ", cloud v" + cloudVersion);

        // Deep clone to avoid mutations
        const local = JSON.parse(JSON.stringify(localState || {}));
        const cloud = JSON.parse(JSON.stringify(cloudState || {}));

        const merged = { ...cloud }; // Start with cloud as base

        // Fields that are additive (arrays/objects to merge)
        const additiveFields = [
            "customWords",
            "quizHistory",
            "mistakes",
            "review",
            "srs",
            "studyDays",
            "feat",
            "askill",
            "advChal",
            "gweak",
            "timeLog",
            "events",
            "evSeen",
            "tutor",
            "plan2",
            "grammar",
            "journey",
            "dlife",
            "myg",
            "writing",
            "speaking"
        ];

        // Fields where we take the maximum (counters)
        const maxFields = [
            "totalCorrect",
            "totalAnswered",
            "testsTaken",
            "fixedTotal",
            "xp",
            "bestPct",
            "maxCombo",
            "evSeq"
        ];

        // Fields where we take the latest by timestamp
        const timestampFields = [
            "lastActivity",
            "lastQuiz",
            "place",
            "daily",
            "streak"
        ];

        // Merge additive fields (arrays/objects)
        additiveFields.forEach(field => {
            const localVal = local[field];
            const cloudVal = cloud[field];

            if (!localVal && !cloudVal) return;

            if (Array.isArray(localVal) && Array.isArray(cloudVal)) {
                // Merge arrays, deduplicate by id
                const combined = [...cloudVal];
                const seen = new Set(cloudVal.map(item => item.id || JSON.stringify(item)));
                localVal.forEach(item => {
                    const key = item.id || JSON.stringify(item);
                    if (!seen.has(key)) {
                        combined.push(item);
                        seen.add(key);
                    }
                });
                merged[field] = combined;
            } else if (typeof localVal === "object" && typeof cloudVal === "object") {
                // Merge objects - local wins for conflicts (more recent device)
                merged[field] = { ...cloudVal, ...localVal };
            } else if (localVal !== undefined) {
                merged[field] = localVal;
            }
        });

        // Merge max fields (take maximum)
        maxFields.forEach(field => {
            const localVal = Number(local[field]) || 0;
            const cloudVal = Number(cloud[field]) || 0;
            merged[field] = Math.max(localVal, cloudVal);
        });

        // Merge timestamp fields (take latest)
        timestampFields.forEach(field => {
            const localVal = local[field];
            const cloudVal = cloud[field];

            if (!localVal && !cloudVal) return;
            if (!localVal) { merged[field] = cloudVal; return; }
            if (!cloudVal) { merged[field] = localVal; return; }

            // Compare timestamps
            const localTime = localVal.ts || localVal.last || localVal.date || 0;
            const cloudTime = cloudVal.ts || cloudVal.last || cloudVal.date || 0;

            merged[field] = (localTime >= cloudTime) ? localVal : cloudVal;
        });

        // Settings: prefer local (user's current device preferences)
        if (local.settings) {
            merged.settings = { ...cloud.settings, ...local.settings };
        }

        // Planner: merge intelligently
        if (local.planner || cloud.planner) {
            merged.planner = mergePlanner(local.planner, cloud.planner);
        }

        // Streak: take the one with higher count (more progress)
        if (local.streak || cloud.streak) {
            const localCount = local.streak?.count || 0;
            const cloudCount = cloud.streak?.count || 0;
            merged.streak = (localCount >= cloudCount) ? local.streak : cloud.streak;
        }

        // Favs: union
        if (local.favs || cloud.favs) {
            const combined = [...new Set([...(cloud.favs || []), ...(local.favs || [])])];
            merged.favs = combined;
        }

        // Status: prefer "known" > "hard" > "review" > "later" > "new"
        if (local.status || cloud.status) {
            merged.status = mergeStatus(local.status, cloud.status);
        }

        return { state: merged };
    }

    // Merge planner states
    function mergePlanner(local, cloud) {
        const today = new Date().toISOString().split("T")[0];
        const result = { ...cloud, ...local };

        // If same day, take max of counters
        if (local?.day === cloud?.day && local?.day === today) {
            result.dw = Math.max(local.dw || 0, cloud.dw || 0);
            result.ds = Math.max(local.ds || 0, cloud.ds || 0);
            result.dm = Math.max(local.dm || 0, cloud.dm || 0);
        } else if (local?.day === today) {
            // Local is today's data, prefer it
            result.day = local.day;
            result.dw = local.dw;
            result.ds = local.ds;
            result.dm = local.dm;
        }

        // Take higher goals
        result.words = Math.max(local?.words || 20, cloud?.words || 20);
        result.sentences = Math.max(local?.sentences || 10, cloud?.sentences || 10);
        result.minutes = Math.max(local?.minutes || 30, cloud?.minutes || 30);

        return result;
    }

    // Merge status objects (prefer higher mastery)
    function mergeStatus(local, cloud) {
        const order = { known: 5, hard: 4, review: 3, later: 2, new: 1 };
        const merged = { ...cloud };

        Object.keys(local || {}).forEach(id => {
            const localSt = order[local[id]] || 0;
            const cloudSt = order[cloud[id]] || 0;
            merged[id] = localSt >= cloudSt ? local[id] : cloud[id];
        });

        return merged;
    }

    // Apply merged state to local Store
    function applyMergedState(mergedState) {
        if (!window.S) return;

        // Normalize first: cloud data may carry explicit nulls / wrong types
        // (older clients, partial writes). normalizeState coerces known fields
        // back to their shapes and never deletes unknown keys.
        var incoming = mergedState;
        try { if (typeof normalizeState === "function") incoming = normalizeState(mergedState); } catch (e) {}

        // Preserve certain local-only fields
        const preservedFields = ["uiLang", "flashDir", "notifRead"];
        const preserved = {};
        preservedFields.forEach(f => { if (window.S[f] !== undefined) preserved[f] = window.S[f]; });

        // Merge into S
        Object.assign(window.S, incoming);

        // Restore preserved
        Object.assign(window.S, preserved);

        // Save to localStorage
        try { window.save?.(); } catch (e) {}

        // Trigger UI refresh
        if (typeof window.renderAll === "function") {
            try { window.renderAll(); } catch (e) {}
        }

        console.log("[Sync] Applied merged state to local Store");
    }

    // ==================== OFFLINE QUEUE ====================

    const QUEUE_KEY = "dm_sync_queue";

    function loadPendingQueue() {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            if (raw) {
                const queue = JSON.parse(raw);
                syncState.pendingCount = queue.length;
            }
        } catch (e) {}
    }

    function savePendingQueue(queue) {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            syncState.pendingCount = queue.length;
            notifyStatusChange();
        } catch (e) {}
    }

    function getPendingQueue() {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    // Queue an operation for later sync. Operations are bound to the user id
    // that was active when they were created ("guest" while signed out) so an
    // offline write can never be uploaded under a different account later.
    function queueOperation(type, payload, userId) {
        const queue = getPendingQueue();
        queue.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type,
            payload,
            userId: userId || "guest",
            createdAt: new Date().toISOString(),
            retries: 0
        });
        savePendingQueue(queue);
        setStatus(syncState.status, { pendingCount: queue.length });
        console.log("[Sync] Queued operation:", type);
        return { success: false, queued: true };
    }

    // Recompute the visible pending count for the ACTIVE identity only, so one
    // account never appears to carry another account's queued work.
    function refreshPendingCount() {
        try {
            const queue = getPendingQueue();
            const active = activeUserId;
            const mine = queue.filter(function (op) {
                return (op.userId || "guest") === (active || "guest");
            });
            syncState.pendingCount = mine.length;
            notifyStatusChange();
            updateSyncIndicator();
        } catch (e) {}
        return syncState.pendingCount;
    }

    // Process the offline queue
    async function processQueue() {
        if (!supabaseClient || !isOnline) return;

        const queue = getPendingQueue();
        if (!queue.length) return;

        setStatus(SYNC_STATUS.SYNCING);

        const remaining = [];

        for (const op of queue) {
            const owner = op.userId || "guest";
            const active = activeUserId || "guest";
            if (owner !== active) {
                // Belongs to a different identity: keep queued WITHOUT counting
                // it as a failure, so it can still upload under its own account.
                remaining.push(op);
                continue;
            }
            if (owner === "guest") {
                // Guest-bound work is adopted explicitly at sign-in (merged into
                // the account flow), never uploaded on its own: hold it here
                // without burning retries.
                remaining.push(op);
                continue;
            }
            try {
                await executeOperation(op);
                console.log("[Sync] Processed queued operation:", op.type);
            } catch (e) {
                console.warn("[Sync] Queue operation failed:", op.type, e);
                op.retries = (op.retries || 0) + 1;
                if (op.retries < 5) {
                    remaining.push(op); // Re-queue with backoff
                } else {
                    console.error("[Sync] Operation failed permanently:", op);
                }
            }
        }

        savePendingQueue(remaining);
        refreshPendingCount();
        setStatus(SYNC_STATUS.ONLINE, { pendingCount: syncState.pendingCount });
    }

    // Execute a queued operation
    // Same read-before-write guard as uploadChanges: a stale queued payload
    // must never clobber newer cloud progress when connectivity returns.
    async function executeOperation(op) {
        const user = window.AuthModule?.getUser?.();
        if (!user) throw new Error("No user");
        const owner = op.userId || "guest";
        if (owner !== user.id || !checkActive(user.id)) {
            throw new Error("Superseded: account changed");
        }

        switch (op.type) {
            case "upsert_progress": {
                let stateToUpload = op.payload.state;
                let version = getLocalVersion() + 1;
                try {
                    const { data: cloudRow, error: cloudError } = await supabaseClient
                        .from("user_progress")
                        .select("state, version")
                        .eq("user_id", user.id)
                        .single();
                    if (!cloudError && cloudRow && (cloudRow.version || 0) >= version) {
                        const merged = mergeStates(op.payload.state, cloudRow.state || {}, getLocalVersion(), cloudRow.version || 0);
                        stateToUpload = merged.state;
                        version = (cloudRow.version || 0) + 1;
                    }
                } catch (e) {
                    console.warn("[Sync] Queue version pre-check failed, uploading queued state:", e);
                }
                const { error } = await supabaseClient
                    .from("user_progress")
                    .upsert({
                        user_id: user.id,
                        state: stateToUpload,
                        version,
                        device_id: window.AuthModule?.getDeviceId?.(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: "user_id" });
                if (error) throw error;
                if (stateToUpload !== op.payload.state) applyMergedState(stateToUpload);
                setLocalVersion(version);
                currentVersion = version;
                break;
            }
            default:
                console.warn("[Sync] Unknown operation type:", op.type);
        }
    }

    // ==================== AUTO SYNC ====================

    // Start periodic sync
    function startAutoSync(intervalMs = 60000) {
        stopAutoSync();
        syncInterval = setInterval(() => {
            const user = window.AuthModule?.getUser?.();
            if (user && isOnline && syncState.status !== SYNC_STATUS.SYNCING) {
                uploadChanges(user.id, window.S);
            }
        }, intervalMs);
        console.log("[Sync] Auto-sync started every", intervalMs, "ms");
    }

    function stopAutoSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    // Trigger immediate sync
    async function syncNow() {
        const user = window.AuthModule?.getUser?.();
        if (!user) return { success: false, error: "Not authenticated" };
        return fullSync(user.id, window.S);
    }

    // ==================== CONFLICT RESOLUTION ====================

    // Handle version conflict (called when versions don't match)
    async function resolveConflict(userId, localState, cloudState, localVersion, cloudVersion) {
        console.log("[Sync] Conflict detected - local v" + localVersion + " vs cloud v" + cloudVersion);

        // Use deterministic merge
        const merged = mergeStates(localState, cloudState, localVersion, cloudVersion);
        const newVersion = Math.max(localVersion, cloudVersion) + 1;

        // Upload resolved state
        const { error } = await supabaseClient
            .from("user_progress")
            .upsert({
                user_id: userId,
                state: merged.state,
                version: newVersion,
                device_id: window.AuthModule?.getDeviceId?.(),
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (error) throw error;

        applyMergedState(merged.state);
        setLocalVersion(newVersion);
        currentVersion = newVersion;

        return { success: true, version: newVersion };
    }

    // ==================== FIRST LOGIN MIGRATION ====================

    // Migrate existing local progress to cloud on first login
    async function migrateLocalToCloud(userId, localState) {
        console.log("[Sync] First login migration for user:", userId);

        // Check if cloud already has data
        const { data: existing } = await supabaseClient
            .from("user_progress")
            .select("state, version")
            .eq("user_id", userId)
            .single();

        if (existing && Object.keys(existing.state || {}).length > 0) {
            // Cloud has data - merge
            console.log("[Sync] Cloud has existing data - merging");
            return fullSync(userId, localState);
        }

        // Cloud is empty - upload local
        console.log("[Sync] Cloud empty - uploading local progress");
        const version = 1;
        const { error } = await supabaseClient
            .from("user_progress")
            .upsert({
                user_id: userId,
                state: localState,
                version,
                device_id: window.AuthModule?.getDeviceId?.(),
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (error) throw error;

        setLocalVersion(version);
        currentVersion = version;

        // Also register device
        await window.AuthModule?.registerDevice?.();

        return { success: true, version, migrated: true };
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        onStatusChange,
        getStatus: () => syncState,
        setActiveUser,
        getActiveUser,
        refreshPendingCount,
        fullSync,
        uploadChanges,
        downloadState,
        syncNow,
        startAutoSync,
        stopAutoSync,
        migrateLocalToCloud,
        resolveConflict,
        queueOperation,
        processQueue,
        getLocalVersion,
        getCloudVersion,
        mergeStates,
        SYNC_STATUS
    };
})();

// Export
window.CloudSync = CloudSync;
if (typeof module !== "undefined" && module.exports) {
    module.exports = CloudSync;
}