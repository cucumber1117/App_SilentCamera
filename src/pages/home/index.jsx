import React, { useRef, useEffect, useState } from 'react';

const HomePage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    // カメラ起動
    const initCamera = async () => {
      try {
        // まず外カメラを試す
        let mediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // 外カメラを優先
          });
        } catch (err) {
          // 外カメラが使えない場合は内カメラを試す
          console.warn('外カメラが使えません、内カメラを試します:', err);
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
          });
        }
        
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('カメラを利用できません:', err);
        const errorMessage = `カメラを利用できません: ${err.message}\n\n` +
          `HTTPSでアクセスしている場合は http://133.14.177.54:5173/ を試してください。\n` +
          `ブラウザでカメラの許可を求められた場合は「許可」を選択してください。`;
        alert(errorMessage);
      }
    };

    initCamera();

    // クリーンアップ
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 無音で撮影
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 画像データURL取得
    const dataURL = canvas.toDataURL('image/png');
    setCapturedImage(dataURL);
  };

  const downloadImage = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `silent_photo_${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      maxWidth: '500px',
      margin: '0 auto'
    }}>
      <h1>シャッター音なしカメラ</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <video 
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '100%', 
            maxWidth: '400px',
            border: '2px solid #ddd',
            borderRadius: '8px'
          }}
        />
      </div>

      <button 
        onClick={capturePhoto}
        style={{
          fontSize: '18px',
          padding: '12px 24px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        📸 撮影
      </button>

      <canvas 
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {capturedImage && (
        <div>
          <h3>撮影した写真</h3>
          <img 
            src={capturedImage} 
            alt="撮影した写真"
            style={{ 
              width: '100%', 
              maxWidth: '400px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              marginBottom: '10px'
            }}
          />
          <br />
          <button 
            onClick={downloadImage}
            style={{
              fontSize: '16px',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            📥 ダウンロード
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
