import React, { useState } from 'react';
import './Gallery.css';
import PhotoEditor from './PhotoEditor';

const Gallery = ({ photoHistory, onClose, onUpdatePhoto }) => {
  const [editingPhoto, setEditingPhoto] = useState(null);

  const handleDownload = (photo) => {
    const link = document.createElement('a');
    link.href = photo.dataURL;
    link.download = `silent_photo_${photo.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePhotoClick = (photo) => {
    setEditingPhoto(photo);
  };

  const handleEditClose = () => {
    setEditingPhoto(null);
  };

  const handleEditSave = (editedPhoto) => {
    onUpdatePhoto(editedPhoto);
    setEditingPhoto(null);
  };

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <button 
          onClick={onClose}
          className="gallery-close-button"
          title="戻る"
        >
          ← 戻る
        </button>
        <h2 className="gallery-title">撮影した写真 ({photoHistory.length})</h2>
      </div>
      
      {photoHistory.length > 0 ? (
        <div className="gallery-grid">
          {photoHistory.map((photo) => (
            <div key={photo.id} className="gallery-item">
              <img 
                src={photo.dataURL} 
                alt={`撮影 ${new Date(photo.timestamp).toLocaleString()}`}
                className="gallery-image"
                onClick={() => handlePhotoClick(photo)}
                style={{ cursor: 'pointer' }}
              />
              <div className="gallery-item-info">
                {new Date(photo.timestamp).toLocaleString('ja-JP', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <button 
                onClick={() => handleDownload(photo)}
                className="gallery-download-button"
                title="ダウンロード"
              >
                💾
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="gallery-empty">
          📸 まだ写真がありません
        </div>
      )}
      
      {/* 写真編集モード */}
      {editingPhoto && (
        <PhotoEditor
          photo={editingPhoto}
          onClose={handleEditClose}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default Gallery;