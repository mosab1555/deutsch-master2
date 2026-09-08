# Deutsch Master — Build Guide (APK + EXE)

## ما تمت إضافته (بدون المساس بالموقع الداخلي)

| ملف | الوظيفة |
|---|---|
| `launch.js` + `launch.css` | شاشة Splash كل تشغيل + Welcome أول مرة فقط |
| `manifest.json` + `sw.js` | PWA: تثبيت + عمل Offline |
| `icons/` | كل الأيقونات (192/512/maskable/apple/favicon/ICO/Splash) |
| `capacitor.config.json` + `android/` | مشروع Android الأصلي |
| `electron/main.js` | نافذة Windows المستقلة |
| `tools/make-www.js` | نسخ ملفات الموقع إلى `www/` (خطوة تقنية فقط) |
| `package.json` | سكربتات البناء |

**الموقع الداخلي لم يتغير:** نفس الصفحات والاختبارات والكلمات والألوان والحفظ (`index.html` أُضيفت له 3 أسطر فقط في الـhead وبداية الـbody).

## Android APK

### المتطلبات (مرة واحدة)
1. Node.js LTS + Java 17 + Android Studio (مع Android SDK).
2. داخل مجلد المشروع:
```cmd
npm install
npm run www
```

### أمر إنشاء APK (Debug — للتثبيت المباشر)
```cmd
npm run apk
```
### مكان ملف APK
```
android\app\build\outputs\apk\debug\app-debug.apk
```
### التثبيت على الهاتف
1. انسخ `app-debug.apk` إلى الهاتف (USB / واتساب / درايف).
2. افتحه من مدير الملفات → السماح بـ"التثبيت من مصادر غير معروفة" → تثبيت.
3. الأيقونة 🇩🇪 ستظهر بجانب تطبيقاتك، يفتح مباشرة بدون متصفح.

### نسخة Release (اختياري)
```cmd
npm run apk-release
```
تحتاج توقيعًا (keystore) — راجع توثيق Android الرسمي لتوليد واحد.

## Windows EXE

### المتطلبات
Node.js فقط، ثم داخل مجلد المشروع:
```cmd
npm install
```

### أمر إنشاء المثبت
```cmd
npm run dist-win
```
### مكان الملفات
```
dist\Deutsch Master Setup.exe   ← المثبت (Next → Install)
dist\Deutsch-Master-Portable.exe ← نسخة محمولة بدون تثبيت
```
- النافذة بعنوان **Deutsch Master** وأيقونة البرنامج، تعمل مستقلة تمامًا (لا Chrome).
- بعد التثبيت تظهر Splash ثم Welcome (أول مرة) ثم الموقع كما هو.

## ملاحظات
- شاشة Welcome تظهر **أول تشغيل فقط** (محفوظة في `localStorage` باسم `dm_welcomed`).
- لمسح حالة Welcome للتجربة: احذف `dm_welcomed` من Application → Local Storage في أدوات المطور.
- بديل سريع بدون بناء: افتح الموقع عبر HTTPS ثم من قائمة المتصفح "تثبيت التطبيق" (PWA).
