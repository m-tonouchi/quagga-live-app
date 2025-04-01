// アプリケーション定数
const APP_CONFIG = {
    CAMERA: {
        PADDING: 20,
        STATES: {
            RUNNING: 'running',
            PAUSED: 'paused',
            STOPPED: 'stopped'
        },
        CONSTRAINTS: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            aspectRatio: { min: 1, max: 2 },
            facingMode: "environment"
        }
    },
    SCAN: {
        MIN_CONFIDENCE: 0.05,
        RETRY_COUNT: 3
    }
};

// ユーティリティ関数
const utils = {
    handleError(error, message) {
        console.error(message, error);
        document.getElementById("result").innerHTML = `
            <div style="background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <p><strong>エラー:</strong> ${message}</p>
                <p><small>${error.message}</small></p>
            </div>
        `;
    },

    drawDetectionResult(result, ctx, canvas, video) {
        if (!ctx || !canvas || !video) return;
    
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        // スケール計算
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;
    
        // 候補の枠（黄色）
        if (result.boxes) {
            ctx.strokeStyle = 'rgba(255, 235, 59, 0.5)';
            ctx.lineWidth = 2;
            result.boxes.filter(box => box !== result.box)
                       .forEach(box => this.drawBox(ctx, box, scaleX, scaleY));
        }
    
        // 確定した枠（緑）
        if (result.box) {
            ctx.strokeStyle = 'rgba(76, 175, 80, 1)';
            ctx.lineWidth = 2;
            this.drawBox(ctx, result.box, scaleX, scaleY);
        }
    
        // デバッグ用の枠（青）
        if (result.pattern) {
            ctx.strokeStyle = 'rgba(33, 150, 243, 0.7)';
            ctx.lineWidth = 1;
            this.drawPattern(ctx, result.pattern, scaleX, scaleY);
        }
    },
    
    drawBox(ctx, box, scaleX = 1, scaleY = 1) {
        ctx.beginPath();
        ctx.moveTo(box[0][0] * scaleX, box[0][1] * scaleY);
        box.forEach(point => ctx.lineTo(point[0] * scaleX, point[1] * scaleY));
        ctx.closePath();
        ctx.stroke();
    },
    
    drawPattern(ctx, pattern, scaleX = 1, scaleY = 1) {
        if (!pattern) return;
        ctx.beginPath();
        pattern.forEach(point => {
            ctx.moveTo((point.x - 2) * scaleX, (point.y - 2) * scaleY);
            ctx.lineTo((point.x + 2) * scaleX, (point.y + 2) * scaleY);
            ctx.moveTo((point.x + 2) * scaleX, (point.y - 2) * scaleY);
            ctx.lineTo((point.x - 2) * scaleX, (point.y + 2) * scaleY);
        });
        ctx.stroke();
    }    
}

document.addEventListener("DOMContentLoaded", async function() {
    /* QRコード生成を一時的に無効化
    setTimeout(() => {
        try {
            if (window.innerWidth > 480) {
                const currentUrl = window.location.href;
                const qrcodeElement = document.getElementById('qrcode');
                
                if (typeof QRCode === 'undefined') {
                    console.error('QRCodeライブラリが読み込まれていません');
                    return;
                }

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
    }, 1000);
    */

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

    // Quagga設定
    const quaggaConfig = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: APP_CONFIG.CAMERA.CONSTRAINTS,
            area: { top: "30%", right: "20%", left: "20%", bottom: "30%" }
        },
        locate: true,
        numOfWorkers: 2,
        decoder: {
            readers: ["ean_reader", "ean_8_reader"],
            debug: { showCanvas: true, showPatches: true },
            multiple: false,
            tryHarder: true,
            frequency: 1
        }
    };

    const config = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: APP_CONFIG.CAMERA.CONSTRAINTS,
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
                showPattern: true,
                showSkeleton: true
            },
            multiple: false,
            tryHarder: true,
            frequency: 1,
            minConfidence: APP_CONFIG.SCAN.MIN_CONFIDENCE,
            halfSample: true,
            debug: true,
            patchSize: "large",
            supplements: [],
            decodeRetries: APP_CONFIG.SCAN.RETRY_COUNT
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
                    utils.handleError(err, "Quagga initialization error");
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
                    utils.handleError(err, "Quagga initialization error");
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

        // Quaggaの初期化状態を管理
        let isInitialized = false;

        // カメラとスキャンの状態管理を追加
        let currentCameraState = APP_CONFIG.CAMERA.STATES.STOPPED;

        // カメラ制御関数を改善
        function controlCamera(state) {
            return new Promise((resolve, reject) => {
                try {
                    switch (state) {
                        case APP_CONFIG.CAMERA.STATES.RUNNING:
                            if (currentCameraState !== APP_CONFIG.CAMERA.STATES.RUNNING) {
                                Quagga.start();
                                currentCameraState = APP_CONFIG.CAMERA.STATES.RUNNING;
                                console.log('カメラ: 実行中');
                            }
                            break;
                        case APP_CONFIG.CAMERA.STATES.PAUSED:
                            if (currentCameraState === APP_CONFIG.CAMERA.STATES.RUNNING) {
                                Quagga.pause();
                                currentCameraState = APP_CONFIG.CAMERA.STATES.PAUSED;
                                console.log('カメラ: 一時停止');
                            }
                            break;
                        case APP_CONFIG.CAMERA.STATES.STOPPED:
                            if (currentCameraState !== APP_CONFIG.CAMERA.STATES.STOPPED) {
                                Quagga.stop();
                                currentCameraState = APP_CONFIG.CAMERA.STATES.STOPPED;
                                console.log('カメラ: 停止');
                            }
                            break;
                    }
                    resolve();
                } catch (error) {
                    utils.handleError(error, 'カメラ制御エラー');
                    reject(error);
                }
            });
        }

        // バーコード検出時の処理をシンプル化
        Quagga.onDetected(function(result) {
            if (!result.codeResult) return;

            try {
                const code = result.codeResult.code;
                // バーコードタイプを取得
                const barcodeType = document.getElementById('barcodeType').value;
                const resultElement = document.getElementById("result");
                
                resultElement.innerHTML = `
                    <div style="background-color: #e8f5e9; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <p><strong>スキャン結果:</strong> ${code}</p>
                        <p><small>タイプ: ${barcodeType}</small></p>
                        <svg id="my_barcode"></svg>
                        <div style="margin-top: 10px; text-align: center;">
                            <button onclick="confirmScan(true)" class="confirm-btn success">OK</button>
                            <button onclick="restartScan()" class="confirm-btn warning">再スキャン</button>
                        </div>
                    </div>
                `;

                // バーコードタイプに応じてフォーマットを設定
                const format = barcodeType === 'ean' ? 'EAN13' :
                              barcodeType === 'ean_8' ? 'EAN8' :
                              barcodeType === 'code_128' ? 'CODE128' :
                              barcodeType === 'code_39' ? 'CODE39' :
                              barcodeType === 'upc' ? 'UPC' : 'EAN13';

                // バーコードの描画（SVG要素を使用）
                JsBarcode("#my_barcode", code, {
                    format: format,
                    width: 2,
                    height: 100,
                    displayValue: true,
                    margin: 10,
                    background: "#ffffff"
                });

            } catch (error) {
                utils.handleError(error, 'バーコード表示中にエラーが発生');
            }
        });

        // onProcessedイベントハンドラーを追加
        Quagga.onProcessed(function(result) {
            if (!result || typeof result !== 'object') return;
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;
            const video = document.querySelector('video');
        
            utils.drawDetectionResult(result, drawingCtx, drawingCanvas, video);

            // バーコードの数値表示を一時的に無効化
            /* 
            // 検出されたパターンを表示
            if (result.codeResult && result.codeResult.code) {
                drawingCtx.font = '1.5em Arial';
                drawingCtx.fillStyle = '#00F';
                drawingCtx.fillText(result.codeResult.code, 10, 20);
            }
            */
        });

        // 再スキャン機能の修正
        window.restartScan = async function() {
            try {
                await controlCamera(APP_CONFIG.CAMERA.STATES.STOPPED);
                await new Promise(resolve => setTimeout(resolve, 500));
                await controlCamera(APP_CONFIG.CAMERA.STATES.RUNNING);
                
                const resultElement = document.getElementById("result");
                resultElement.innerHTML = `
                    <div style="background-color: #FFC107; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <p>スキャンを開始します...</p>
                    </div>
                `;
            } catch (error) {
                utils.handleError(error, '再スキャン中にエラーが発生');
            }
        };

        // スキャン確認処理も修正
        window.confirmScan = function(isConfirmed) {
            if (isConfirmed) {
                // OKの場合はカメラを完全停止
                controlCamera(APP_CONFIG.CAMERA.STATES.STOPPED);
                document.getElementById("result").innerHTML += `
                    <div style="background-color: #4CAF50; color: white; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <p>スキャンが完了しました。</p>
                    </div>
                `;
            } else {
                // 再スキャンの場合はカメラを再開
                controlCamera(APP_CONFIG.CAMERA.STATES.RUNNING);
                document.getElementById("result").innerHTML = '';
            }
        };

        // 初期スキャン開始
        restartScan();

    } catch (err) {
        utils.handleError(err, "カメラの初期化に失敗しました");
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