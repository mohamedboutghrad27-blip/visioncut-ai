# VisionCut AI — Desktop App (نسخة سطح المكتب)

تطبيق سطح مكتب ملفّوف بـ **Electron** حول تطبيق VisionCut AI على الويب، مع قوائم أصلية، حفظ التصديرات عبر نافذة حفظ النظام، فتح الروابط الخارجية في المتصفح، وقفل نسخة واحدة.

> اللغة العربية أولاً، ثم الإنجليزية — The Arabic section comes first, then English.

---

## العربية

### ماذا يفعل التطبيق؟
- يفتح استوديو VisionCut كاملاً في نافذة سطح مكتب أصلية (1440×900).
- قائمة File للوصول السريع إلى Dashboard / مشروع جديد، وقائمة View (تكبير، ملء الشاشة، أدوات المطور).
- أي رابط خارج الموقع يُفتح في متصفحك الافتراضي بدل فتحه داخل التطبيق.
- تصدير الفيديو/الوسائط يمر عبر نافذة "حفظ باسم" أصلية.
- قائمة Help فيها: الموقع، سياسة الخصوصية، شروط الاستخدام، والبريد الدعمي.
- نسخة واحدة فقط من التطبيق تعمل في نفس الوقت.

### التشغيل أثناء التطوير (يحتاج Node.js 18+)
```bash
cd desktop
npm install
npm start                      # يفتح نسخة الإنتاج https://visioncut-ai-mu.vercel.app
# أو وجّهه إلى خادم محلي:
VISIONCUT_URL=http://localhost:3000 npm start
```

### بناء مُثبِّت (Installer)
```bash
cd desktop
npm install
npm run dist:linux   # AppImage + deb في مجلد release/
npm run dist:win     # مثبّت NSIS لـ Windows (ابنِه من ويندوز أو CI)
npm run dist:mac     # DMG لأجهزة Mac (من macOS أو CI)
```
الملفات الناتجة تظهر في `desktop/release/`.

### ملاحظات
- التطبيق يحمّل واجهة الويب نفسها، لذلك أي تحديث للنشر الإنتاجي يصل للتطبيق تلقائياً بدون إعادة بناء.
- الأيقونة في `desktop/build/icon.png`.
- التحديث التلقائي (auto-update) غير مفعّل بعد — البناء يدوي.

---

## English

### What it does
- Runs the full VisionCut studio in a native window (1440×900).
- File menu shortcuts to Dashboard / New Project; View menu with zoom, fullscreen and devtools.
- Links outside the app origin open in your default browser.
- Video/media exports use the native Save dialog.
- Help menu: website, Privacy Policy, Terms of Service, support email.
- Single-instance lock.

### Development (needs Node.js 18+)
```bash
cd desktop
npm install
npm start                      # loads https://visioncut-ai-mu.vercel.app
VISIONCUT_URL=http://localhost:3000 npm start   # local backend
```

### Build installers
```bash
npm run dist:linux   # AppImage + deb into release/
npm run dist:win     # NSIS installer (build on Windows/CI)
npm run dist:mac     # DMG (build on macOS/CI)
```

### Files
- `main.cjs` — Electron main process (window, menu, navigation guard, downloads).
- `preload.cjs` — safe bridge exposing `window.visioncutDesktop` info only.
- `electron-builder.yml` — packaging config (AppImage/deb/NSIS/DMG).
- `build/icon.png` — app icon.

The shell loads the production web app, so web updates reach the desktop build automatically. Auto-update is not wired yet — rebuild to distribute new versions.
