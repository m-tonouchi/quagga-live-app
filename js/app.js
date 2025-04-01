document.addEventListener("DOMContentLoaded", async function() {
    // QRコードの生成を遅延実行
    setTimeout(() => {
        try {
            if (window.innerWidth > 480) {
                const currentUrl = window.location.href;
                const qrcodeElement = document.getElementById('qrcode');
                
                if (typeof QRCode === 'undefined') {
                    console.error('QRCodeライブラリが読み込まれていません');
                    return;
                }

                // QRコード生成メソッドを変更
                new QRCode(qrcodeElement, {
                    text: currentUrl,
                    width: 180,
                    height: 180,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        } catch (error) {
            console.error('QRコード生成中にエラーが発生しました:', error);
        }
    }, 1000);  // 1秒待機に変更

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
                width: { min: 640, ideal: 1280, max: 1920 },  // 解像度を調整
                height: { min: 480, ideal: 720, max: 1080 },
                aspectRatio: { min: 1, max: 2 },
                // カメラ設定を最適化
                advanced: [
                    {
                        focusMode: "continuous",
                        exposureMode: "continuous",
                        whiteBalanceMode: "continuous",
                        zoom: 1.5  // ズーム倍率を調整
                    }
                ]
            },
            area: {
                // スキャンエリアを広げる
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
                showPattern: true,
                showSkeleton: true
            },
            multiple: false,
            // デコーダー設定を最適化
            tryHarder: true,
            frequency: 1,            // 連続スキャンの間隔を短縮
            minConfidence: 0.05,     // 信頼度の閾値をさらに下げる
            halfSample: true,        // 処理速度と精度のバランスを取る
            debug: true,
            patchSize: "large",      // パッチサイズを大きくして精度を向上
            supplements: [],
            decodeRetries: 3        // 再試行回数を設定
        },
        locator: {
            patchSize: "medium",
            halfSample: true,
            debug: {
                showCanvas: true,
                showPatches: true,
                showFoundPatches: true
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

        // バーコードタイプの選択処理を追加
        const barcodeSelect = document.getElementById('barcodeType');
        
        barcodeSelect.addEventListener('change', function() {
            // Quaggaを一旦停止
            if (Quagga.initialized) {
                Quagga.stop();
            }

            // 選択されたバーコードタイプに基づいてreadersを設定
            const selectedType = this.value;
            const readers = selectedType === 'all' 
                ? ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader", "code_39_reader"]
                : [selectedType + "_reader"];

            // 設定を更新
            config.decoder.readers = readers;

            // Quaggaを再初期化
            Quagga.init(config, function(err) {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    return;
                }
                Quagga.start();
            });
        });

        // 信頼度の計算を修正
        function calculateConfidence(result) {
            if (!result || !result.codeResult || typeof result.codeResult.confidence !== 'number') {
                return '未計測';
            }
            return `${Math.min(100, Math.max(0, (result.codeResult.confidence * 100))).toFixed(1)}%`;
        }

        // バーコード検出時の処理を改善
        Quagga.onDetected(function(result) {
            const confidenceValue = calculateConfidence(result);
            const barcodeType = document.getElementById('barcodeType').value;
            const detectedType = result.codeResult.format.toLowerCase();
            
            // 選択したタイプと一致するか確認
            if (barcodeType !== 'all' && !detectedType.includes(barcodeType)) {
                console.log('異なるタイプのバーコードを検出:', detectedType);
                return;
            }

            document.getElementById("result").innerHTML = `
                <div style="background-color: #e8f5e9; padding: 10px; border-radius: 4px; margin-top: 10px;">
                    <p><strong>スキャン結果:</strong> ${result.codeResult.code}</p>
                    <p><strong>スキャン時刻:</strong> ${new Date().toLocaleTimeString()}</p>
                    <p><strong>バーコードタイプ:</strong> ${result.codeResult.format}</p>
                    <p><strong>信頼度:</strong> ${confidenceValue}</p>
                </div>
            `;
            
            // ビープ音を鳴らす
            const beep = new Audio("data:audio/wav;base64,UklGRj4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRoAAAAaGhpic3R0dHR0dHNic2pqampqamtsbGxsbAAA");
            beep.play().catch(e => console.log("音声再生エラー:", e));

            // 処理性能のログ出力
            console.log('スキャン性能:', {
                処理時間: `${(performance.now() - startTime).toFixed(2)}ms`,
                信頼度: confidenceValue,
                コード: result.codeResult.code,
                フォーマット: result.codeResult.format
            });
        });

        let scanAttempts = 0;
        let successfulScans = 0;

        // 処理状態の表示
        Quagga.onProcessed(function(result) {
            scanAttempts++;
            if (result && result.codeResult) {
                successfulScans++;
                const confidenceValue = calculateConfidence(result);
                
                // スキャン統計のログ出力
                console.log('スキャン統計:', {
                    試行回数: scanAttempts,
                    成功回数: successfulScans,
                    成功率: `${((successfulScans/scanAttempts) * 100).toFixed(1)}%`,
                    信頼度: confidenceValue,
                    平均処理時間: `${(performance.now()/scanAttempts).toFixed(2)}ms`,
                    生データ: result.codeResult  // デバッグ用
                });
            }

            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;

            // パフォーマンスモニタリングを追加
            const startTime = performance.now();

            if (result) {
                // 前回の描画をクリア
                if (drawingCtx) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.width), parseInt(drawingCanvas.height));
                }

                if (drawingCtx) {
                    // コントラストと明るさの調整を強化
                    drawingCtx.filter = 'contrast(1.6) brightness(1.3) saturate(1.4)';
                    
                    // 画像処理の最適化
                    drawingCtx.imageSmoothingEnabled = true;
                    drawingCtx.imageSmoothingQuality = 'high';
                    
                    // シャープネス処理の追加
                    drawingCtx.shadowBlur = 0;
                    drawingCtx.globalCompositeOperation = 'source-over';
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
                    updateScanGuide(result);
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

                // デバッグ情報を詳細に表示
                console.log('画像処理情報:', {
                    イメージサイズ: `${result.inputImageWidth}x${result.inputImageHeight}`,
                    バーコード検出: result.boxes ? '成功' : '失敗',
                    処理時間: `${performance.now() - startTime}ms`,
                    エラー: result.error || 'なし'
                });

                // エラー検出と再試行ロジック
                if (result && result.error) {
                    console.warn('スキャンエラー:', result.error);
                    if (result.error === 'no code found') {
                        // 自動再スキャン
                        setTimeout(() => {
                            Quagga.start();
                        }, 100);
                    }
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

function updateScanGuide(result) {
    const statusEl = document.getElementById('scan-status');
    
    if (!result.box) {
        statusEl.textContent = 'バーコードを枠内に配置してください';
        return;
    }

    const box = result.box;
    const brightness = calculateBrightness(result.imageData);

    if (brightness < 50) {
        statusEl.textContent = '明るい場所で撮影してください';
        statusEl.className = 'scan-status scan-warning';
    } else if (brightness > 200) {
        statusEl.textContent = '光の反射を避けてください';
        statusEl.className = 'scan-status scan-warning';
    } else if (box.width < 100) {
        statusEl.textContent = 'バーコードをもう少し近づけてください';
        statusEl.className = 'scan-status scan-warning';
    } else if (box.width > 300) {
        statusEl.textContent = 'バーコードを少し離してください';
        statusEl.className = 'scan-status scan-warning';
    } else {
        statusEl.textContent = 'スキャン中...';
        statusEl.className = 'scan-status scan-active';
    }
}