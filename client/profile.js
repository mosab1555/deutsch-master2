/* Deutsch Master - Profile Module
   User profile management, account settings, sync status display
*/
"use strict";

const ProfileModule = (function () {
    "use strict";

    let profileCache = null;

    // Get profile data
    async function getProfile() {
        const user = window.AuthModule?.getUser?.();
        if (!user) return null;

        try {
            const { data, error } = await window.supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) throw error;
            profileCache = data;
            return data;
        } catch (e) {
            console.warn("[Profile] Get profile failed:", e);
            return null;
        }
    }

    // Update profile
    async function updateProfile(updates) {
        const user = window.AuthModule?.getUser?.();
        if (!user) return { error: "Not authenticated" };

        try {
            const { data, error } = await window.supabaseClient
                .from("profiles")
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq("id", user.id)
                .select()
                .single();

            if (error) throw error;
            profileCache = data;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e.message };
        }
    }

    // Update display name
    async function updateDisplayName(name) {
        return updateProfile({ display_name: name.trim() });
    }

    // Update avatar
    async function updateAvatar(url) {
        return updateProfile({ avatar_url: url });
    }

    // Get sync status info
    async function getSyncStatus() {
        const user = window.AuthModule?.getUser?.();
        if (!user) return null;

        try {
            const { data: progress } = await window.supabaseClient
                .from("user_progress")
                .select("version, updated_at, device_id")
                .eq("user_id", user.id)
                .single();

            const { data: devices } = await window.supabaseClient
                .from("devices")
                .select("device_id, device_name, platform, last_sync_at, created_at")
                .eq("user_id", user.id);

            return {
                progress: progress || { version: 0, updated_at: null },
                devices: devices || []
            };
        } catch (e) {
            console.warn("[Profile] Get sync status failed:", e);
            return { progress: { version: 0 }, devices: [] };
        }
    }

    // Get auth provider display name
    function getProviderDisplayName(provider) {
        const names = {
            google: "Google",
            facebook: "Facebook",
            email: "Email",
            phone: "Phone"
        };
        return names[provider] || provider;
    }

    // Format last seen
    function formatLastSeen(isoString) {
        if (!isoString) return "\u2014";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        const L = window.S?.uiLang || "ar";

        if (diffMins < 1) return L === "ar" ? "\u0627\u0644\u0622\u0646" : (L === "de" ? "jetzt" : "now");
        if (diffMins < 60) return L === "ar" ? `\u0645\u0630 ${diffMins} \u062F\u0642\u064A\u0642\u0629` : (L === "de" ? `vor ${diffMins} Min` : `${diffMins}m ago`);
        if (diffHours < 24) return L === "ar" ? `\u0645\u0630 ${diffHours} \u0633\u0627\u0639\u0629` : (L === "de" ? `vor ${diffHours} Std` : `${diffHours}h ago`);
        if (diffDays < 7) return L === "ar" ? `\u0645\u0630 ${diffDays} \u0623\u064A\u0627\u0645` : (L === "de" ? `vor ${diffDays} Tagen` : `${diffDays}d ago`);

        return date.toLocaleDateString(L === "ar" ? "ar-EG" : (L === "de" ? "de-DE" : "en-US"));
    }

    // Render profile page
    function renderProfilePage() {
        const user = window.AuthModule?.getUser?.();
        if (!user) return;

        const box = document.getElementById("profileBox");
        if (!box) return;

        const profile = profileCache || user;
        const provider = user.app_metadata?.provider || user.user_metadata?.provider || "email";
        const providerName = getProviderDisplayName(provider);
        const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || "";
        const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

        const L = window.S?.uiLang || "ar";
        const t = window.t || ((k) => k);

        box.innerHTML = `
            <div class="profile-header glass">
                <div class="profile-avatar">
                    ${avatar ? `<img src="${avatar}" alt="Avatar">` : `<div class="avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`}
                </div>
                <div class="profile-info">
                    <h3>${escapeHtml(displayName)}</h3>
                    <div class="profile-meta">
                        <span class="provider-badge">${escapeHtml(providerName)}</span>
                        <span class="email">${escapeHtml(user.email || user.phone || "")}</span>
                    </div>
                </div>
            </div>

            <div class="profile-section glass">
                <h4>${t("account_settings") || "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628"}</h4>
                <div class="form-group">
                    <label>${t("display_name") || "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0645\u0639\u0631\u0648\u0636"}</label>
                    <input type="text" id="profileDisplayName" value="${escapeHtml(displayName)}" placeholder="${t("enter_name") || "\u0623\u062F\u062E\u0644 \u0627\u0633\u0645\u0643"}">
                    <button class="btn btn-primary sm" id="saveDisplayName">${t("save") || "\u062D\u0641\u0638"}</button>
                </div>
            </div>

            <div class="profile-section glass">
                <h4>${t("sync_status") || "\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629"}</h4>
                <div id="syncStatusDisplay" class="sync-status-display">
                    <div class="loading">${t("loading") || "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644..."}</div>
                </div>
            </div>

            <div class="profile-section glass">
                <h4>${t("devices") || "\u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u062A\u0635\u0644\u0629"}</h4>
                <div id="devicesList" class="devices-list">
                    <div class="loading">${t("loading") || "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644..."}</div>
                </div>
            </div>

            <div class="profile-section glass danger-zone">
                <h4>${t("danger_zone") || "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062E\u0637\u0631"}</h4>
                <button class="btn btn-red" id="signOutBtn">${t("sign_out") || "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C"}</button>
                <button class="btn btn-ghost sm" id="deleteAccountBtn" style="margin-top:8px">${t("delete_account") || "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628"}</button>
            </div>
        `;

        // Event listeners
        const saveNameBtn = document.getElementById("saveDisplayName");
        const nameInput = document.getElementById("profileDisplayName");
        const signOutBtn = document.getElementById("signOutBtn");
        const deleteBtn = document.getElementById("deleteAccountBtn");

        saveNameBtn?.addEventListener("click", async () => {
            const name = nameInput?.value?.trim();
            if (name) {
                const result = await updateDisplayName(name);
                if (result.error) {
                    window.toast?.(window.AuthModule?.translateError?.({ message: result.error }) || "\u0641\u0634\u0644 \u0627\u0644\u062D\u0641\u0638", "err");
                } else {
                    window.toast?.(t("saved") || "\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u2705", "ok");
                }
            }
        });

        signOutBtn?.addEventListener("click", async () => {
            if (confirm(t("confirm_signout") || "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C\u063F")) {
                await window.AuthModule?.signOut?.();
            }
        });

        deleteBtn?.addEventListener("click", async () => {
            if (confirm(t("confirm_delete") || "\u0647\u0630\u0627 \u0633\u064A\u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0648\u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0646\u0647\u0627\u0626\u064A\u0627\u064B. \u0647\u0644 \u0623\u0646\u062A \u0645\u062A\u0623\u0643\u062F\u063F")) {
                window.toast?.("\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u064A\u062A\u0637\u0644\u0628 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0641\u064A Supabase Dashboard", "err");
            }
        });

        // Load sync status and devices
        loadSyncStatusDisplay();
        loadDevicesDisplay();
    }

    async function loadSyncStatusDisplay() {
        const container = document.getElementById("syncStatusDisplay");
        if (!container) return;

        const status = await getSyncStatus();
        const L = window.S?.uiLang || "ar";
        const t = window.t || ((k) => k);

        if (!status) {
            container.innerHTML = `<div class="muted">${t("sync_unavailable") || "\u063A\u064A\u0631 \u0645\u062A\u0627\u062D"}</div>`;
            return;
        }

        const { progress, devices } = status;
        const lastSync = progress.updated_at ? formatLastSeen(progress.updated_at) : (t("never_synced") || "\u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0623\u0628\u062F\u0627\u064B");
        const version = progress.version || 0;

        container.innerHTML = `
            <div class="sync-info-row">
                <span>${t("last_sync") || "\u0622\u062E\u0631 \u0645\u0632\u0627\u0645\u0646\u0629"}</span>
                <strong>${escapeHtml(lastSync)}</strong>
            </div>
            <div class="sync-info-row">
                <span>${t("data_version") || "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"}</span>
                <strong>v${version}</strong>
            </div>
            <div class="sync-info-row">
                <span>${t("connected_devices") || "\u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0645\u062A\u0635\u0644\u0629"}</span>
                <strong>${devices.length}</strong>
            </div>
            <button class="btn btn-primary sm" id="manualSyncBtn" style="margin-top:8px">
                ${t("sync_now") || "\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0622\u0646"}
            </button>
        `;

        document.getElementById("manualSyncBtn")?.addEventListener("click", async () => {
            const btn = document.getElementById("manualSyncBtn");
            btn.disabled = true;
            btn.textContent = t("syncing") || "\u062C\u0627\u0631\u064A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629...";
            await window.CloudSync?.syncNow?.();
            btn.disabled = false;
            btn.textContent = t("sync_now") || "\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0622\u0646";
            loadSyncStatusDisplay();
        });
    }

    async function loadDevicesDisplay() {
        const container = document.getElementById("devicesList");
        if (!container) return;

        const status = await getSyncStatus();
        const L = window.S?.uiLang || "ar";
        const t = window.t || ((k) => k);

        if (!status || !status.devices.length) {
            container.innerHTML = `<div class="muted">${t("no_devices") || "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u062C\u0647\u0632\u0629 \u0645\u0633\u062C\u0644\u0629"}</div>`;
            return;
        }

        const currentDeviceId = window.AuthModule?.getDeviceId?.();

        container.innerHTML = status.devices.map(device => `
            <div class="device-item ${device.device_id === currentDeviceId ? "current" : ""}">
                <div class="device-info">
                    <strong>${escapeHtml(device.device_name || "Unknown Device")}</strong>
                    <span class="device-platform">${escapeHtml(device.platform || "web")}</span>
                    ${device.device_id === currentDeviceId ? `<span class="current-badge">${t("this_device") || "\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632"}</span>` : ""}
                </div>
                <div class="device-meta">
                    <span>Last sync: ${formatLastSeen(device.last_sync_at)}</span>
                </div>
            </div>
        `).join("");
    }

    function escapeHtml(s) {
        const map = { "&": "&", "<": "<", ">": ">", '"': "\"", "'": "'" };
        return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) { return map[c]; });
    }

    // Initialize profile page when shown
    function initProfilePage() {
        const user = window.AuthModule?.getUser?.();
        if (user && !profileCache) {
            getProfile();
        }
        renderProfilePage();
    }

    return {
        getProfile,
        updateProfile,
        updateDisplayName,
        updateAvatar,
        getSyncStatus,
        renderProfilePage,
        initProfilePage,
        formatLastSeen,
        getProviderDisplayName
    };
})();

window.ProfileModule = ProfileModule;
if (typeof module !== "undefined" && module.exports) {
    module.exports = ProfileModule;
}