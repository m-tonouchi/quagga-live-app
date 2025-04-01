document.addEventListener("DOMContentLoaded", async function() {
    // PCの場合のみQRコードを生成
    if (window.innerWidth > 480) {
        const currentUrl = window.location.href;
        QRCode.toCanvas(document.getElementById('qrcode'), currentUrl, {
            width: 180,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    }

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
                // カメラの制約を緩和
                width: { min: 320, ideal: 640, max: 1280 },
                height: { min: 240, ideal: 480, max: 720 },
                aspectRatio: { min: 1, max: 2 },
                // facingModeの制約を緩和
                facingMode: "environment"  // exactを削除
            },
            area: {
                top: "30%",
                right: "20%",
                left: "20%",
                bottom: "30%"
            }
        },
        locate: true,
        numOfWorkers: 2,
        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader"
            ],
            debug: {
                drawBoundingBox: true,
                showPattern: true
            }
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

        console.log("QuaggaJS initialized successfully");
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

                // コントラスト強調
                if (drawingCtx) {
                    drawingCtx.filter = 'contrast(1.2) brightness(1.1)';
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

                // バーコードエリアの処理を修正
                if (result.box) {
                    const box = result.box;
                    const angle = Math.atan2(box.height, box.width) * (180/Math.PI);
                    drawingCtx.strokeStyle = "#F00";
                    drawingCtx.lineWidth = 2;
                    
                    // 歪み補正処理
                    if (Math.abs(angle) > 5) {  // 5度以上の傾きがある場合
                        drawingCtx.save();
                        drawingCtx.translate(box.x + box.width/2, box.y + box.height/2);
                        drawingCtx.rotate(angle * Math.PI/180);
                        drawingCtx.translate(-(box.x + box.width/2), -(box.y + box.height/2));
                    }

                    // バーコードの枠を描画
                    drawingCtx.beginPath();
                    drawingCtx.rect(box.x, box.y, box.width, box.height);
                    drawingCtx.stroke();

                    if (Math.abs(angle) > 5) {
                        drawingCtx.restore();  // 変換を元に戻す
                    }

                    // スキャン状態の表示
                    const statusEl = document.getElementById('scan-status');
                    if (Math.abs(angle) > 15) {
                        statusEl.textContent = 'バーコードをまっすぐに持ってください';
                        statusEl.className = 'scan-status scan-warning';
                    } else if (box.width < 100) {
                        statusEl.textContent = 'バーコードをもう少し近づけてください';
                        statusEl.className = 'scan-status scan-warning';
                    } else if (box.width > 300) {
                        statusEl.textContent = 'バーコードを少し離してください';
                        statusEl.className = 'scan-status scan-warning';
                    } else {
                        statusEl.textContent = 'バーコード検出中...';
                        statusEl.className = 'scan-status scan-active';
                    }
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
        console.error("Error:", err);
        document.getElementById("result").innerHTML = `
            <div style="color: red; padding: 10px;">
                カメラの初期化に失敗しました: ${err.name}<br>
                <small>お使いのブラウザでカメラへのアクセスが許可されているか確認してください。</small>
            </div>
        `;
    }
});