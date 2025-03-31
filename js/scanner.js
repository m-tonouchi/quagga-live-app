// scanner.js

// QuaggaJSの初期化とスキャナーの設定
function initScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#video') // HTMLのvideo要素を指定
        },
        decoder: {
            readers: ["code_128_reader"] // 使用するバーコードリーダーを指定
        }
    }, function(err) {
        if (err) {
            console.error(err);
            return;
        }
        console.log("QuaggaJSが初期化されました");
        Quagga.start();
    });
}

// バーコードが検出されたときの処理
Quagga.onDetected(function(data) {
    const code = data.codeResult.code;
    console.log("検出されたバーコード:", code);
    // 検出結果を処理するロジックをここに追加
});

// スキャナーを停止する関数
function stopScanner() {
    Quagga.stop();
}

// 初期化関数を呼び出す
initScanner();