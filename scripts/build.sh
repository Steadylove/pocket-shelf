#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"
sdk="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
bt="$sdk/build-tools/36.0.0"
platform="$sdk/platforms/android-36/android.jar"
rm -rf build/classes build/dex build/apk build/generated
mkdir -p build/{classes,dex,apk} dist
python3 - <<'PY'
import os
from pathlib import Path
text = Path('AndroidManifest.xml').read_text()
if os.environ.get('POCKET_DEBUG') == '1':
    text = text.replace('<application ', '<application android:debuggable="true" ')
Path('build/AndroidManifest.xml').write_text(text)
PY
"$bt/aapt2" compile --dir res -o build/resources.zip
"$bt/aapt2" link -o build/base.apk -I "$platform" --manifest build/AndroidManifest.xml -A assets build/resources.zip --java build/generated
find src build/generated -name '*.java' > build/sources.txt
javac --release 8 -Xlint:unchecked -cp "$platform:libs/jlibtorrent-2.0.15.3.jar" -d build/classes @build/sources.txt
jar cf build/app.jar -C build/classes .
"$bt/d8" --min-api 26 --lib "$platform" --output build/dex build/app.jar libs/jlibtorrent-2.0.15.3.jar
cp build/base.apk build/unsigned.apk
unzip -oq libs/jlibtorrent-android-arm64-2.0.15.3.jar 'lib/*' -d build/apk
cp build/dex/classes*.dex build/apk/
(cd build/apk && zip -q -r ../unsigned.apk .)
"$bt/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$bt/apksigner" sign --ks "${POCKET_KEYSTORE:-$HOME/.android/debug.keystore}" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out dist/pocket-shelf.apk build/aligned.apk
"$bt/apksigner" verify --verbose dist/pocket-shelf.apk
shasum -a 256 dist/pocket-shelf.apk
