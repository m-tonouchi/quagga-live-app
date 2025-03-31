document.addEventListener("DOMContentLoaded", async function() {
    console.log("DOM loaded, initializing Quagga...");

    // カメラのサポートチェック
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById("result").innerHTML = `
            <div style="background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <p><strong>エラー:</strong> お使いのブラウザはカメラをサポートしていません。</p>
                <p>以下をお試しください：</p>
                <ul>
                    <li>最新のChromeまたはSafariを使用する</li>
                    <li>HTTPSで接続する</li>
                    <li>プライベートブラウジングモードを無効にする</li>
                </ul>
            </div>
        `;
        return;
    }

    const config = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: {
                width: { min: 640, ideal: 1280 },  // 解像度を上げる
                height: { min: 480, ideal: 720 },
                aspectRatio: { min: 1, max: 2 },
                facingMode: { exact: "environment" },
                frameRate: { min: 15, ideal: 30 }  // フレームレートを安定化
            },
            area: {
                top: "30%",    // スキャンエリアを広げる
                right: "20%",
                left: "20%",
                bottom: "30%"
            }
        },
        locate: true,
        numOfWorkers: navigator.hardwareConcurrency || 4,  // ワーカー数を増やす
        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader"
            ],
            debug: {
                drawBoundingBox: true,
                showPattern: true
            },
            multiple: false,
            frequency: 10,     // スキャン頻度を上げる
            minLength: 8,
            maxLength: 13,
            threshold: 0.15    // 感度を少し下げて誤検出を減らす
        },
        locator: {
            patchSize: "medium",
            halfSample: false  // 精度優先のため、フルサイズで処理
        }
    };

    try {
        // QuaggaJSの初期化前に既存のインスタンスを停止
        if (Quagga.initialized) {
            Quagga.stop();
        }

        await new Promise((resolve, reject) => {
            Quagga.init(config, function(err) {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        
        console.log("QuaggaJS initialization succeeded");
        Quagga.start();

        // バーコード検出時の処理を改善
        Quagga.onDetected(function(result) {
            const code = result.codeResult.code;
            const timestamp = new Date().toLocaleTimeString();
            const confidence = (result.codeResult.confidence * 100).toFixed(1);
            
            document.getElementById("result").innerHTML = `
                <div style="background-color: #e8f5e9; padding: 10px; border-radius: 4px; margin-top: 10px;">
                    <p><strong>スキャン結果:</strong> ${code}</p>
                    <p><strong>スキャン時刻:</strong> ${timestamp}</p>
                    <p><strong>バーコードタイプ:</strong> ${result.codeResult.format}</p>
                    <p><strong>信頼度:</strong> ${confidence}%</p>
                </div>
            `;
            
            // ビープ音を鳴らす
            const beep = new Audio("data:audio/wav;base64,UklGRj4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRoAAAAaGhpic3R0dHR0dHNic2pqampqamtsbGxsbAAA");
            beep.play().catch(e => console.log("音声再生エラー:", e));
        });

        // 処理状態の表示
        Quagga.onProcessed(function(result) {
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;

            // パフォーマンスモニタリングを追加
            const startTime = performance.now();

            if (result) {
                // 前回の描画をクリア
                if (drawingCtx) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
                }

                // バーコードが検出された場合
                if (result.boxes) {
                    drawingCtx.strokeStyle = "#00F";
                    drawingCtx.lineWidth = 2;

                    result.boxes.filter(function(box) {
                        return box !== result.box;
                    }).forEach(function(box) {
                        drawingCtx.beginPath();
                        drawingCtx.rect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
                        drawingCtx.stroke();
                    });

                    const statusEl = document.getElementById('scan-status');
                    statusEl.textContent = 'バーコード検出中...';
                    statusEl.className = 'scan-status scan-active';
                }

                // 確定したバーコードエリアを赤色で表示
                if (result.box) {
                    drawingCtx.strokeStyle = "#F00";
                    drawingCtx.lineWidth = 2;
                    drawingCtx.beginPath();
                    drawingCtx.rect(
                        result.box.x,
                        result.box.y,
                        result.box.width,
                        result.box.height
                    );
                    drawingCtx.stroke();
                }

                if (result.codeResult) {
                    const statusEl = document.getElementById('scan-status');
                    statusEl.textContent = `検出成功: ${result.codeResult.code}`;
                    statusEl.className = 'scan-status scan-success';

                    const endTime = performance.now();
                    console.log('スキャン性能:', {
                        処理時間: `${(endTime - startTime).toFixed(2)}ms`,
                        信頼度: `${(result.codeResult.confidence * 100).toFixed(1)}%`,
                        コード: result.codeResult.code,
                        フォーマット: result.codeResult.format
                    });
                }
            } else {
                const statusEl = document.getElementById('scan-status');
                statusEl.textContent = 'スキャン待機中...';
                statusEl.className = 'scan-status';
            }

            // デバッグ情報をコンソールに出力
            if (result && result.codeResult) {
                console.log('検出結果:', {
                    code: result.codeResult.code,
                    format: result.codeResult.format,
                    confidence: result.codeResult.confidence
                });
            }
        });

    } catch (err) {
        console.error("Quagga initialization failed:", err);
        document.getElementById("result").textContent = 
            `カメラの初期化に失敗しました: ${err.name} - ${err.message}`;
    }
});