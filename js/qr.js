// --- XỬ LÝ DOWNLOAD QR CODE CHO IPHONE SAFARI (WEB SHARE API) ---
window.downloadQRCode = async function(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Trên iOS Safari: mở Share Menu hệ thống với tùy chọn 'Lưu hình ảnh' (Save Image)
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({
        files: [file],
        title: 'Mã QR Mừng Cưới',
      });
      return;
    }

    // Trên Desktop: Tải trực tiếp qua Blob URL
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    const win = window.open(url, '_blank');
    if (win) {
      alert("Vui lòng chạm giữ vào ảnh QR và chọn 'Lưu hình ảnh' (Save Image) vào máy.");
    }
  }
};
