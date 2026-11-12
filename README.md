# 口袋游戏库 · Pocket Shelf

给当前安卓手机上的 Omnidroid 配套的下载与游戏库工具。包名 `dev.pocket.shelf`，版本 **1.2.0**；arm64-v8a / Android 8.0+。Java 原生文件授权、网络、下载服务和本地 WebView 界面。按 GPL-3.0-only 提供源码。

项目起因、需求演变、用户偏好和架构取舍见 [项目背景与决策记录](docs/PROJECT_BACKGROUND.md)。

## 当前默认来源

默认界面只保留两个精选提供方，移除了早期 37 个 Megathread 分类入口：

| 来源              | 用途               | 方式                  |
| ----------------- | ------------------ | --------------------- |
| Edge Emulation    | 经典主机游戏主目录 | 免登录 HTTPS 文件直链 |
| Libretro 公共内容 | 公共游戏与演示内容 | 免登录 HTTPS 文件直链 |

默认不展示需登录的 Archive 条目、BT 目录、整包入口、未知平台映射或只会跳转到网页的下载方式。以前的已完成和暂停任务保留；内嵌 BT 内核保留用于旧任务续传，不再作为默认游戏下载来源。

初始直链目录快照为 2026-11-12：Edge 的 FC / SFC / GBA / MD 分别 4065 / 3940 / 3356 / 2743 条，GB / GBC 分别 1998 / 1905 条；加上 Libretro 的 46 条公共内容，共 **18053 个版本条目**。地区、修订版和演示内容分别计数，不是独立游戏数量或逐一验证成功的数量。

主源另接入 NDS、N64、Game Gear、Master System、32X、PC Engine，目录按需读取。3DS、PS2 等尚无本次筛选通过的直链来源，暂不出现在默认下载平台中；不会因此卸载或改变 Omnidroid 内核。

来源地址：<https://edgeemu.net/>、<https://buildbot.libretro.com/assets/cores/>。主源来自 Megathread 公开列出的直链站点；没有修改或绕过网站访问限制。

## 下载前检测

1. 选择游戏后，先用普通 HTTPS `Range: bytes=0-63` 请求检查实际响应，不发送账号、密码或 Cookie。
2. 处理正常 HTTPS 跳转，拒绝 HTML、JSON、空文件、401 / 403 / 404 / 410 等响应；ZIP、7z 必须有相应二进制文件头。
3. 检测通过才进入下载队列，完成后导入对应 ROMs 子目录。下载阶段继续检查响应类型、续传位置、文件长度及 ZIP 结构。
4. 确认失效或受限的文件从目录隐藏，缓存 6 小时；手动刷新该目录可清除隐藏记录再试。临时网络超时不永久隐藏，保留重试。
5. 成功检测短时缓存 5 分钟；「可用来源」的检测按钮检查少量样本，不宣称提供方内所有文件永远可下载。

目录能列出名字，不代表文件始终可用。默认来源经过平台抽样检测；具体文件以下载前的实际检查为准。ZIP / 7z 保留原包，交给 Omnidroid 识别，不在本工具内解压任意文件。

## 使用

1. 连接 `内部存储/ROMs` 文件夹，与 Omnidroid 使用同一个目录。目录授权持久保存。
2. 首页选择平台，搜索游戏或常见中文系列别名，选择地区，点击下载。
3. 检测、下载完成后，游戏自动进入 `ROMs/nes`、`snes`、`gba`、`md` 等对应目录。
4. 在「下载任务」或「本地游戏」点击「开玩」，调用 Omnidroid 的 `ExternalGameLauncherActivity` 直接运行文件。
5. 若要在 Omnidroid 自己的大厅显示新游戏，仍需重新扫描 ROMs。没有调用不存在的自动刷新接口。

设置页可粘贴已有的实际 HTTPS ROM / ZIP / 7z 文件链接，同样先检测后下载。游戏真实兼容性、BIOS 和解密需求仍由 Omnidroid 决定。

## 界面与滚动

1.1.0 起采用中性深灰、紧凑平台卡片与简短文案，移除卡通插画、荧光配色和大幅宣传内容。

根窗口固定大小；导航与 `main` 是两个独立滚动区域，导航手势不会带动内容。横屏侧栏保留标签，竖屏采用两列卡片与底部导航。内容在底栏上方结束，切换栏目回到顶部，本地游戏刷新时保留滚动位置。

已验证 360 / 375 / 773 / 1100px 布局、滚轮、触摸手势和减少动态效果模式。真机横竖屏测试中，内容位置 160 在侧栏或底栏滑动后仍为 160，内容自身滑动后正常增加；根页面始终为 0。

## 文件与权限

- 仅申请选定 ROMs 文件夹的 SAF 读写权限，无所有文件访问、联系人、摄像头或麦克风权限。
- `dataSync` 前台服务负责下载；通知只询问一次，拒绝后仍能在任务页查看进度。
- 私有临时文件下载完成后写入隐藏临时文档，再重命名。已有同名游戏保留，不覆盖存档或 Omnidroid 配置。
- HTTP 下载支持正确的 Range 续传；进程退出后任务暂停，用户点击继续，不在开机时自动下载。
- 本地界面与第三方网页隔离。第三方 HTML 只作为不执行脚本的数据解析，原生 bridge 不暴露给外部网页。

## 构建与检查

工作区最初没有 Android 工程、Gradle、TypeScript 或 lint 配置。本项目直接使用 Android SDK，不宣称不存在的 lint / TypeScript / Gradle 检查通过。

```sh
python3 scripts/bootstrap.py
bash scripts/build.sh
npm ci
npm test
npm run test:ui
```

需要 JDK 17、Android SDK platform android-36 / build-tools 36.0.0。可用 `JAVA_HOME`、`ANDROID_SDK_ROOT`、`POCKET_KEYSTORE` 指定位置。默认使用本机 Android debug keystore 签名；正常构建关闭 debuggable / WebView 调试，是个人安装包，没有发布商店。

Java 格式化使用 `tools/google-java-format.jar`，网页 / 测试使用 `.prettierrc.json` 的 Prettier 配置。`npm ci` 按锁文件安装 Playwright 与 Prettier。界面测试在 macOS 默认使用本机 Chrome；其他系统可执行 `npx playwright install chromium`，或通过 `CHROME_EXECUTABLE` 指定浏览器。`PLAYWRIGHT_MODULE` 可选用于已有的 Playwright 模块路径。原生输入与文件头边界检查：

```sh
javac --release 8 -cp build/classes:$ANDROID_SDK_ROOT/platforms/android-36/android.jar -d build/test-classes tests/NativeSafetyTest.java
java -cp build/test-classes:build/classes:$ANDROID_SDK_ROOT/platforms/android-36/android.jar dev.pocket.shelf.NativeSafetyTest
```

`python3 scripts/refresh-direct.py` 读取提供方公开目录，重新生成 `assets/direct.json`；该文件是紧凑生成数据，不手动修改。脚本以两个并发连接读取字母分页，缓存目录，并仅用少量文件头做平台抽样。旧的 `refresh-index.py` 只保留为历史导入工具，其 Megathread / Minerva 数据不会自动加载到默认界面。

调试验证命令：

```sh
POCKET_DEBUG=1 bash scripts/build.sh
# 安装到已授权的测试手机后：
ANDROID_SERIAL=your-device-serial npm run test:android:sources
ANDROID_SERIAL=your-device-serial npm run test:android:scroll
```

测试只连接本工具自己的调试进程，结束时移除自己的 ADB 转发；滚动测试恢复原来的屏幕方向。真机测试要求显式指定 `ANDROID_SERIAL`，并使用 PATH 中的 adb 或 `ANDROID_ADB` 指定的程序。项目未配置项目级 Git Hook；提交前运行现有检查，不绕过检查失败。

## 真机验证

Honor PGT-AN10 / Android 16：

- 1.2：本工具的原生下载前检测成功读取 FC / SFC / GBA / MD 四个不同的真实 ZIP 文件头与总大小；故意提供网页 URL 时被正确拒绝。
- 1.2：从 Edge 下载 `Nim & Nom (World) (Aftermarket) (Homebrew).zip`，26297 字节，自动写入 `ROMs/nes`，成功调用 Omnidroid 的游戏运行页。
- 1.2：浏览器验证登录 / 私有 / BT / 文件夹条目被筛除、失效链接不入队并隐藏、超时保留重试、两个精选来源及四个屏幕尺寸。
- 1.1：手机真实横竖屏侧栏 / 底栏滚动隔离通过，已有目录授权与游戏库保留。
- 1.0 历史验证：HTTPS 的 Celeste Classic 下载与直启，Minerva BT 单文件下载、SHA-256、暂停 / 重启 / 续传，连续 HTTP 下载任务和已有文件保留通过。这些不能替代新来源中所有游戏的运行验证。

详细结果和截图在 `dist/verification/`，其中 `direct-source-results.json` 记录 1.2 的来源检测、实际下载与启动结果。

## 开源与许可

本工程 GPL-3.0-only，正文见 `LICENSE`。早期来源索引与导航参考 r/ROMs Megathread（站点标注 GPL-3.0）；当前下载目录名称与链接来自相应公开提供方。

旧任务所用的 FrostWire jlibtorrent 2.0.15.3 来自官方发布，MIT 许可；底层 libtorrent 的完整许可随 APK 放在 assets。二进制经过官方 SHA256SUMS 核对，并在 `dependencies.json` 固定哈希；对应 Java 源码 jar 位于 `libs/`，原生源码与构建说明见上游同版本标签与子模块。

APK 和源码包不包含游戏本体、BIOS 或解密密钥；初始目录数据只含名称、大小与公开链接。

## 仓库范围

Git 仓库只包含本项目源码、目录索引、依赖锁文件、许可及项目背景文档。`dist/`、构建缓存、依赖二进制、签名密钥和本机配置均不纳入版本控制；手机游戏与其他工作区项目也不属于本仓库。
