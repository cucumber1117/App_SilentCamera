import React, { useRef, useEffect, useState } from 'react';
import './HomePage.css';
import Gallery from '../gallery/Gallery';

const HomePage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  const [currentFacingMode, setCurrentFacingMode] = useState('environment'); // 'environment' or 'user'
  const [isLoading, setIsLoading] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [zoomLevel, setZoomLevel] = useState(1); // ズームレベル 1-3
  const [photoHistory, setPhotoHistory] = useState([]); // 撮影履歴
  const [showGallery, setShowGallery] = useState(false); // ギャラリー表示状態





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
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setCurrentFacingMode(facingMode);
      } catch (err) {
        // 指定したカメラが使えない場合は逆のカメラを試す
        const fallbackMode = facingMode === 'environment' ? 'user' : 'environment';
        console.warn(`${facingMode}カメラが使えません、${fallbackMode}を試します:`, err);
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: fallbackMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setCurrentFacingMode(fallbackMode);
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

  useEffect(() => {
    initCamera('environment'); // 初期は外カメラを試す

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
  }, []);

  // カメラ切り替え関数
  const switchCamera = async () => {
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    await initCamera(newFacingMode);
  };

  // ズーム機能
  const zoomIn = () => {
    if (zoomLevel < 3) {
      setZoomLevel(prev => Math.min(prev + 0.5, 3));
    }
  };

  const zoomOut = () => {
    if (zoomLevel > 1) {
      setZoomLevel(prev => Math.max(prev - 0.5, 1));
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

    console.log('撮影開始');

    // フラッシュ効果
    showCameraFlash();

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 無音で撮影
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 画像データURL取得
    const dataURL = canvas.toDataURL('image/png');
    console.log('撮影完了、自動保存のみ実行');
    
    // 撮影履歴に追加
    const newPhoto = {
      id: Date.now(),
      dataURL: dataURL,
      timestamp: new Date().toISOString()
    };
    setPhotoHistory(prev => [newPhoto, ...prev]); // 最新を先頭に追加
    
    // 自動保存
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
    setSaveStatus('saving');
    try {
      // 少し待ってから保存（UX向上のため）
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `silent_photo_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setSaveStatus('saved');
        // 3秒後に保存状態をリセット
        setTimeout(() => setSaveStatus(null), 3000);
      }, 500);
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
        </h1>
        
        <div className="video-section">
          <div className="video-container">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            
            {/* カメラ切り替えボタン */}
              <button 
                onClick={switchCamera}
                className="switch-camera-button"
                disabled={isLoading}
                title="カメラ切り替え"
              >
                ⟲
              </button>            {/* ズームコントロール（左側） */}
            <div className="zoom-controls">
              <button 
                onClick={zoomIn}
                className="zoom-button zoom-in"
                disabled={isLoading || zoomLevel >= 3}
                title="ズームイン"
              >
                +
              </button>
              <div className="zoom-level">
                {zoomLevel.toFixed(1)}x
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
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
