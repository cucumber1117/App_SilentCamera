import React, { useRef, useEffect, useState, useCallback } from 'react';
import './HomePage.css';
import Gallery from '../gallery/Gallery';
import { savePhoto, getAllPhotos, deletePhoto } from '../../utils/indexedDB';
import { generateThumbnail, generateThumbnailsForPhotos } from '../../utils/thumbnail';
import { savePhotoOptimally, detectDevice, checkSaveCapabilities } from '../../utils/mobilePhotoSave';

// デバッグ用グローバル関数
window.testIndexedDB = async () => {
  console.log('IndexedDB接続テスト開始...');
  try {
    const testPhoto = {
      id: Date.now(),
      dataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      timestamp: new Date().toISOString(),
      resolution: { width: 1, height: 1 }
    };
    await savePhoto(testPhoto);
    console.log('テスト保存成功');
    const photos = await getAllPhotos();
    console.log('保存された写真数:', photos.length);
    return true;
  } catch (error) {
    console.error('IndexedDBテスト失敗:', error);
    return false;
  }
};

const HomePage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  const [currentFacingMode, setCurrentFacingMode] = useState('environment'); // 'environment' or 'user'
  const [isLoading, setIsLoading] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [zoomLevel, setZoomLevel] = useState(1); // ズームレベル 1-5（より細かく）
  const [photoHistory, setPhotoHistory] = useState([]); // 撮影履歴
  const [showGallery, setShowGallery] = useState(false); // ギャラリー表示状態
  
  // タッチ操作用の状態
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  
  // 解像度設定
  const [resolutionMode, setResolutionMode] = useState('high'); // 'normal', 'high', 'ultra'
  
  // モバイル機能管理
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [saveCapabilities, setSaveCapabilities] = useState(null);





  // カメラ初期化関数
  const initCamera = async (facingMode = 'environment') => {
    setIsLoading(true);
    try {
      // 既存のストリームを停止
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 新しいストリームを取得
      let mediaStream;
      try {
        // 高品質カメラ設定
        const videoConstraints = {
          facingMode: facingMode,
          width: { 
            min: 1280,
            ideal: 3840, // 4K解像度
            max: 4096 
          },
          height: { 
            min: 720,
            ideal: 2160, // 4K解像度
            max: 3072 
          },
          frameRate: { 
            min: 24,
            ideal: 60,
            max: 60 
          },
          // 追加の品質設定
          aspectRatio: { ideal: 16/9 },
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        };

        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: videoConstraints,
          audio: false // 無音カメラなのでaudioは無効
        });
        setCurrentFacingMode(facingMode);
        
        console.log('高品質カメラが初期化されました');
        console.log('ビデオトラック設定:', mediaStream.getVideoTracks()[0].getSettings());
      } catch (err) {
        // 高品質設定で失敗した場合のフォールバック
        console.warn('高品質カメラ設定に失敗、フォールバック設定を試します:', err);
        
        try {
          // 中品質設定でリトライ
          const fallbackConstraints = {
            facingMode: facingMode,
            width: { min: 1280, ideal: 1920, max: 2560 },
            height: { min: 720, ideal: 1080, max: 1440 },
            frameRate: { min: 24, ideal: 30, max: 60 }
          };
          
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: fallbackConstraints,
            audio: false
          });
          setCurrentFacingMode(facingMode);
          console.log('中品質カメラで初期化されました');
          
        } catch (fallbackErr) {
          // それでも失敗した場合は別カメラを試す
          const alternateFacingMode = facingMode === 'environment' ? 'user' : 'environment';
          console.warn(`${facingMode}カメラが使えません、${alternateFacingMode}を試します:`, fallbackErr);
          
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: alternateFacingMode,
              width: { min: 640, ideal: 1920, max: 3840 },
              height: { min: 480, ideal: 1080, max: 2160 },
              frameRate: { ideal: 30 }
            },
            audio: false
          });
          setCurrentFacingMode(alternateFacingMode);
        }
      }
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('カメラを利用できません:', err);
      const errorMessage = `カメラを利用できません: ${err.message}\n\n` +
        `ブラウザでカメラの許可を求められた場合は「許可」を選択してください。`;
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存された写真を読み込む
  const loadSavedPhotos = useCallback(async () => {
    try {
      console.log('保存された写真を読み込み中...');
      const savedPhotos = await getAllPhotos();
      
      // サムネイルが必要な写真があるかチェック
      const photosNeedingThumbnails = savedPhotos.filter(photo => !photo.thumbnail);
      
      if (photosNeedingThumbnails.length > 0) {
        console.log('サムネイルを生成中...', photosNeedingThumbnails.length + '件');
        // サムネイルを生成（非同期で処理）
        const photosWithThumbnails = await generateThumbnailsForPhotos(savedPhotos);
        
        // サムネイルが生成された写真を再保存
        for (const photo of photosWithThumbnails) {
          if (photo.thumbnail && !savedPhotos.find(p => p.id === photo.id)?.thumbnail) {
            try {
              await deletePhoto(photo.id);
              await savePhoto(photo);
            } catch (error) {
              console.warn('サムネイル付き写真の再保存に失敗:', photo.id, error);
            }
          }
        }
        
        setPhotoHistory(photosWithThumbnails);
      } else {
        setPhotoHistory(savedPhotos);
      }
      
      console.log('写真読み込み完了:', savedPhotos.length + '件');
    } catch (error) {
      console.error('写真読み込みエラー:', error);
    }
  }, []);

  useEffect(() => {
    // 初期化処理
    const initialize = async () => {
      // デバイス情報を取得
      const device = detectDevice();
      const capabilities = checkSaveCapabilities();
      setDeviceInfo(device);
      setSaveCapabilities(capabilities);
      console.log('デバイス情報:', device);
      console.log('保存機能:', capabilities);
      
      // カメラ初期化
      initCamera('environment'); // 初期は外カメラを試す
      
      // 保存された写真を読み込み
      await loadSavedPhotos();
    };
    
    initialize();

    // 画面向きの変更を監視
    const handleOrientationChange = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
    };

    // 初期状態を設定
    handleOrientationChange();

    // イベントリスナーを追加
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // クリーンアップ
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [loadSavedPhotos]);

  // 画質向上関数
  const enhanceImageQuality = useCallback((imageData, ctx) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // 軽微なシャープネス向上（アンシャープマスク効果）
    const sharpnessStrength = 0.1; // 控えめな強度
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) { // RGB各チャンネル
          const idx = (y * width + x) * 4 + c;
          
          // 周囲のピクセルとの差分を計算
          const center = data[idx];
          const top = data[((y-1) * width + x) * 4 + c];
          const bottom = data[((y+1) * width + x) * 4 + c];
          const left = data[(y * width + (x-1)) * 4 + c];
          const right = data[(y * width + (x+1)) * 4 + c];
          
          // ラプラシアンフィルタ適用
          const laplacian = (4 * center - top - bottom - left - right);
          const enhanced = center + (laplacian * sharpnessStrength);
          
          // 値の範囲制限
          data[idx] = Math.max(0, Math.min(255, enhanced));
        }
      }
    }
    
    // 処理済みデータを戻す
    ctx.putImageData(imageData, 0, 0);
  }, []);

  // カメラ切り替え関数
  const switchCamera = async () => {
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    await initCamera(newFacingMode);
  };

  // ズーム機能（ボタン操作）
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 5));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 1));
  };

  // 2点間の距離を計算
  const getPinchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // タッチ開始
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPinching(true);
      const distance = getPinchDistance(e.touches[0], e.touches[1]);
      setLastPinchDistance(distance);
    }
  };

  // タッチ移動（ピンチズーム）
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
      const deltaDistance = currentDistance - lastPinchDistance;
      
      if (Math.abs(deltaDistance) > 5) { // 感度調整
        const zoomDelta = deltaDistance * 0.01; // ズーム変化量
        setZoomLevel(prev => {
          const newZoom = prev + zoomDelta;
          return Math.max(1, Math.min(5, newZoom));
        });
        setLastPinchDistance(currentDistance);
      }
    }
  };

  // タッチ終了
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
      setLastPinchDistance(0);
    }
  };

  // ビデオのズーム適用
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${zoomLevel})`;
    }
  }, [zoomLevel]);

    const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    console.log('高解像度撮影開始');

    // フラッシュ効果
    showCameraFlash();

    const ctx = canvas.getContext('2d');
    
    // ビデオの元解像度を取得
    const originalWidth = video.videoWidth;
    const originalHeight = video.videoHeight;
    
    // デバイス能力に応じた解像度設定
    const getOptimalResolution = (videoWidth) => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const maxCanvasSize = 4096; // WebGL制限を考慮
      
      switch (resolutionMode) {
        case 'normal': 
          return {
            multiplier: Math.max(1, devicePixelRatio * 0.75),
            quality: 0.92,
            format: 'image/jpeg'
          };
        case 'high': 
          return {
            multiplier: Math.max(1.5, devicePixelRatio * 1.2),
            quality: 0.98,
            format: 'image/png'
          };
        case 'ultra': 
          const ultraMultiplier = Math.min(3, devicePixelRatio * 2);
          return {
            multiplier: videoWidth * ultraMultiplier <= maxCanvasSize ? ultraMultiplier : maxCanvasSize / videoWidth,
            quality: 1.0,
            format: 'image/png'
          };
        default: 
          return {
            multiplier: Math.max(1.5, devicePixelRatio),
            quality: 0.95,
            format: 'image/png'
          };
      }
    };
    
    const resolutionConfig = getOptimalResolution(originalWidth);
    const resolutionMultiplier = resolutionConfig.multiplier;
    
    // 高解像度キャンバス設定
    canvas.width = originalWidth * resolutionMultiplier;
    canvas.height = originalHeight * resolutionMultiplier;
    
    // 最高品質レンダリング設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // アンチエイリアス設定
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    
    // 高品質変換行列を適用
    ctx.save();
    ctx.scale(resolutionMultiplier, resolutionMultiplier);
    
    // 最高品質で描画（バイリニア補間有効）
    ctx.drawImage(video, 0, 0, originalWidth, originalHeight);
    ctx.restore();
    
    // 画像品質向上のための後処理
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // シャープネス強化（軽微）
    enhanceImageQuality(imageData, ctx);
    
    // 最適化された設定で出力
    const dataURL = canvas.toDataURL(resolutionConfig.format, resolutionConfig.quality);
    console.log(`高品質撮影完了: ${canvas.width}x${canvas.height}px, 形式: ${resolutionConfig.format}, 品質: ${resolutionConfig.quality}`);
    
    // サムネイル生成
    console.log('サムネイル生成中...');
    const thumbnail = await generateThumbnail(dataURL, 200, 200, 0.7);
    
    // 撮影履歴に追加（解像度情報付き）
    const newPhoto = {
      id: Date.now(),
      dataURL: dataURL,
      thumbnail: thumbnail,
      timestamp: new Date().toISOString(),
      resolution: {
        width: canvas.width,
        height: canvas.height,
        multiplier: resolutionMultiplier,
        original: { width: originalWidth, height: originalHeight }
      }
    };
    
    // メモリ上の履歴を更新
    setPhotoHistory(prev => [newPhoto, ...prev]); // 最新を先頭に追加
    
    // IndexedDBに永続保存
    console.log('保存処理開始...');
    setSaveStatus('saving');
    try {
      console.log('savePhoto関数呼び出し中...', newPhoto.id);
      await savePhoto(newPhoto);
      console.log('写真がIndexedDBに保存されました:', newPhoto.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('写真の永続保存に失敗:', error);
      console.error('エラー詳細:', error.message, error.stack);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
    
    // 自動保存（ダウンロード）
    autoSaveImage(dataURL);
  };

  const showCameraFlash = () => {
    // 全画面白フラッシュ効果
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: white;
      z-index: 9999;
      opacity: 0.8;
      pointer-events: none;
    `;
    document.body.appendChild(flash);
    
    // 短時間で消す
    setTimeout(() => {
      flash.style.opacity = '0';
      flash.style.transition = 'opacity 0.2s ease-out';
      setTimeout(() => {
        document.body.removeChild(flash);
      }, 200);
    }, 100);
  };

  const autoSaveImage = async (dataURL) => {
    if (!deviceInfo) return; // デバイス情報がない場合はスキップ
    
    setSaveStatus('saving');
    try {
      // 最適な保存方法で保存
      const result = await savePhotoOptimally(dataURL);
      
      if (result.success) {
        setSaveStatus('saved');
        console.log('写真保存成功:', result.method, result.message);
        
        // 保存方法に応じてメッセージをカスタマイズ
        if (result.method === 'webshare') {
          console.log('📱 写真アプリに保存されました');
        } else {
          console.log('💾 ダウンロードフォルダに保存されました');
        }
      } else {
        setSaveStatus('error');
        console.error('写真保存失敗:', result.message);
      }
      
      // 3秒後に保存状態をリセット
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('自動保存に失敗しました:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };



  return (
    <div className="homepage-container">
      <div className="camera-card">
        <h1 className="camera-title">
          📷 Silent Camera
          {saveStatus && deviceInfo && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && (
                deviceInfo.isMobile && saveCapabilities?.nativePhotoSave ? 
                '� 写真アプリに保存中...' : '💾 ダウンロード中...'
              )}
              {saveStatus === 'saved' && (
                deviceInfo.isMobile && saveCapabilities?.nativePhotoSave ? 
                '✅ 写真アプリに保存' : '✅ ダウンロード完了'
              )}
              {saveStatus === 'error' && '❌ 保存失敗'}
            </span>
          )}
        </h1>
        
        <div className="video-section">
          <div className="video-container">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none' }}
            />
            
            {/* カメラ切り替えボタン */}
              <button 
                onClick={switchCamera}
                className="switch-camera-button"
                disabled={isLoading}
                title="カメラ切り替え"
              >
                ⟲
              </button>
              
            {/* 解像度設定ボタン */}
            <button 
              onClick={() => {
                const modes = ['normal', 'high', 'ultra'];
                const currentIndex = modes.indexOf(resolutionMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setResolutionMode(modes[nextIndex]);
              }}
              className="resolution-button"
              disabled={isLoading}
              title="解像度切り替え"
            >
              <div className="resolution-display">
                <span className="resolution-label">
                  {resolutionMode === 'normal' && 'SD'}
                  {resolutionMode === 'high' && 'HD'}
                  {resolutionMode === 'ultra' && 'UHD'}
                </span>
                <span className="resolution-multiplier">
                  {resolutionMode === 'normal' && '1x'}
                  {resolutionMode === 'high' && '2x'}
                  {resolutionMode === 'ultra' && '3x'}
                </span>
              </div>
            </button>
            
            {/* ズームコントロール（左側） */}
            <div className="zoom-controls">
              <button 
                onClick={zoomIn}
                className="zoom-button zoom-in"
                disabled={isLoading || zoomLevel >= 5}
                title="ズームイン"
              >
                +
              </button>
              <div className={`zoom-level ${isPinching ? 'pinching' : ''}`}>
                {zoomLevel.toFixed(1)}x
                {isPinching && <span className="pinch-indicator">📌</span>}
              </div>
              <button 
                onClick={zoomOut}
                className="zoom-button zoom-out"
                disabled={isLoading || zoomLevel <= 1}
                title="ズームアウト"
              >
                -
              </button>
            </div>

            {/* ギャラリーボタン（左下） */}
            {photoHistory.length > 0 && (
              <button 
                onClick={() => setShowGallery(true)}
                className="gallery-button"
                title="撮影した写真を見る"
              >
                <img 
                  src={photoHistory[0].dataURL} 
                  alt="最新の写真"
                  className="gallery-thumbnail"
                />
                <div className="gallery-count">{photoHistory.length}</div>
              </button>
            )}
          </div>
        </div>

        <div className="controls-section">
          <div className="controls-container">
            <button 
              onClick={capturePhoto}
              className="capture-button"
              disabled={isLoading}
            >
            </button>
            

          </div>
        </div>

        <canvas 
          ref={canvasRef}
          style={{ display: 'none' }}
        />



        {/* ギャラリーページ */}
        {showGallery && (
          <Gallery 
            photoHistory={photoHistory}
            onClose={() => setShowGallery(false)}
            onUpdatePhoto={(editedPhoto) => {
              setPhotoHistory(prev => 
                prev.map(photo => 
                  photo.id === editedPhoto.id ? editedPhoto : photo
                )
              );
            }}
            onDeletePhoto={(photoId) => {
              setPhotoHistory(prev => 
                prev.filter(photo => photo.id !== photoId)
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
