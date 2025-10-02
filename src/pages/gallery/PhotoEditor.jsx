import React, { useState, useRef, useEffect } from 'react';
import './PhotoEditor.css';

const PhotoEditor = ({ photo, onClose, onSave }) => {
  const canvasRef = useRef(null);
  const [resolution, setResolution] = useState(100); // パーセンテージ
  const [quality, setQuality] = useState(90); // JPEG品質 (10-100)
  const [format, setFormat] = useState('png'); // ファイル形式
  const [previewUrl, setPreviewUrl] = useState(photo.dataURL);

  // キャンバスに画像を描画
  const drawImage = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // 解像度に応じてキャンバスサイズを調整
        const newWidth = Math.floor(img.width * (resolution / 100));
        const newHeight = Math.floor(img.height * (resolution / 100));
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // 画像をリサイズして描画
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // プレビュー用のデータURLを生成
        let outputFormat = 'image/png';
        let outputQuality = 1;
        
        if (format === 'jpeg') {
          outputFormat = 'image/jpeg';
          outputQuality = quality / 100;
        }
        
        const newDataURL = canvas.toDataURL(outputFormat, outputQuality);
        setPreviewUrl(newDataURL);
        resolve(newDataURL);
      };
      img.src = photo.dataURL;
    });
  };

  // 設定変更時にプレビューを更新
  useEffect(() => {
    drawImage();
  }, [resolution, quality, format, photo.dataURL]);

  // ダウンロード処理
  const handleDownload = async () => {
    const dataURL = await drawImage();
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `edited_photo_${photo.id}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 保存処理
  const handleSave = async () => {
    const dataURL = await drawImage();
    const editedPhoto = {
      ...photo,
      dataURL: dataURL,
      edited: true,
      editSettings: {
        resolution,
        quality,
        format
      }
    };
    onSave(editedPhoto);
  };

  // ファイルサイズを計算 (概算)
  const getEstimatedSize = () => {
    if (!previewUrl) return '計算中...';
    
    // Base64のデータ部分の長さから概算サイズを計算
    const base64Length = previewUrl.split(',')[1]?.length || 0;
    const sizeInBytes = (base64Length * 3) / 4;
    
    if (sizeInBytes < 1024) {
      return `${Math.round(sizeInBytes)} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${Math.round(sizeInBytes / 1024)} KB`;
    } else {
      return `${Math.round(sizeInBytes / (1024 * 1024) * 100) / 100} MB`;
    }
  };

  return (
    <div className="photo-editor-container">
      <div className="photo-editor-header">
        <button onClick={onClose} className="editor-close-button">
          ← 戻る
        </button>
        <h2 className="editor-title">写真編集</h2>
        <button onClick={handleSave} className="editor-save-button">
          保存
        </button>
      </div>

      <div className="photo-editor-content">
        <div className="preview-section">
          <div className="preview-container">
            <img 
              src={previewUrl} 
              alt="編集プレビュー"
              className="preview-image"
            />
          </div>
          <div className="image-info">
            <span>推定サイズ: {getEstimatedSize()}</span>
          </div>
        </div>

        <div className="controls-section">
          <div className="control-group">
            <label className="control-label">
              解像度: {resolution}%
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className="slider"
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              ファイル形式
            </label>
            <select 
              value={format} 
              onChange={(e) => setFormat(e.target.value)}
              className="format-select"
            >
              <option value="png">PNG (高品質)</option>
              <option value="jpeg">JPEG (圧縮)</option>
            </select>
          </div>

          {format === 'jpeg' && (
            <div className="control-group">
              <label className="control-label">
                品質: {quality}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="slider"
              />
            </div>
          )}

          <div className="action-buttons">
            <button onClick={handleDownload} className="download-button">
              📥 ダウンロード
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PhotoEditor;