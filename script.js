// 获取DOM元素
const imageInput = document.getElementById('imageInput');
const originalPreview = document.getElementById('originalPreview');
const compressedPreview = document.getElementById('compressedPreview');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const downloadButton = document.getElementById('downloadButton');
const originalInfo = document.getElementById('originalInfo');
const compressedInfo = document.getElementById('compressedInfo');

// 文件大小格式化
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 计算图片的最佳尺寸
function calculateSize(width, height, maxWidth = 1920, maxHeight = 1080) {
    let newWidth = width;
    let newHeight = height;

    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        newWidth = Math.round(width * ratio);
        newHeight = Math.round(height * ratio);
    }

    return { width: newWidth, height: newHeight };
}

// 压缩图片
function compressImage(file, quality, keepOriginalSize = false) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                // 计算尺寸
                const size = keepOriginalSize ? 
                    { width: img.width, height: img.height } : 
                    calculateOptimalSize(img.width, img.height, file.size);
                
                // 创建 Canvas
                const canvas = document.createElement('canvas');
                canvas.width = size.width;
                canvas.height = size.height;
                const ctx = canvas.getContext('2d');

                // 绘制图片时使用双线性插值算法
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 清空画布并绘制图片
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, size.width, size.height);

                // 设置压缩参数
                let mimeType = file.type;
                let compressionQuality = quality / 100;

                // 对 PNG 图片特殊处理
                if (file.type === 'image/png') {
                    if (!hasTransparency(ctx, size.width, size.height)) {
                        mimeType = 'image/jpeg'; // 如果不包含透明通道，转换为 JPEG
                    } else {
                        // PNG 图片包含透明通道时的特殊处理
                        compressionQuality = Math.max(compressionQuality, 0.6); // 保持一定的质量以保持透明度
                    }
                }

                // 直接使用设定的压缩质量
                canvas.toBlob(
                    (blob) => {
                        // 如果压缩后的大小大于原始大小，返回原图
                        if (blob.size > file.size) {
                            resolve(file);
                        } else {
                            resolve(blob);
                        }
                    },
                    mimeType,
                    compressionQuality
                );
            };
        };
    });
}

// 计算目标文件大小
function calculateTargetSize(originalSize, quality) {
    // 根据质量百分比计算目标大小
    const minRatio = 0.1; // 最小压缩到原大小的 10%
    const maxRatio = 0.9; // 最大压缩到原大小的 90%
    const ratio = minRatio + (quality / 100) * (maxRatio - minRatio);
    return originalSize * ratio;
}

// 计算最佳输出尺寸
function calculateOptimalSize(width, height, fileSize) {
    // 基础尺寸限制
    let maxWidth = 1920;
    let maxHeight = 1080;

    // 根据文件大小动态调整尺寸限制
    if (fileSize > 5 * 1024 * 1024) { // 5MB
        const scale = Math.min(1, 5 * 1024 * 1024 / fileSize);
        maxWidth = Math.floor(width * scale);
        maxHeight = Math.floor(height * scale);
    }

    let newWidth = width;
    let newHeight = height;

    // 如果图片尺寸超过限制，按比例缩小
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        newWidth = Math.round(width * ratio);
        newHeight = Math.round(height * ratio);
    }

    // 确保尺寸是偶数
    newWidth = Math.floor(newWidth / 2) * 2;
    newHeight = Math.floor(newHeight / 2) * 2;

    return { width: newWidth, height: newHeight };
}

// 检查图片是否包含透明通道
function hasTransparency(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 255) {
            return true;
        }
    }
    return false;
}

// 处理图片上传和压缩
async function handleCompression(file, quality) {
    const keepOriginalSize = document.getElementById('keepSize').checked;
    const compressedBlob = await compressImage(file, quality, keepOriginalSize);
    
    // 显示尺寸信息
    const img = new Image();
    img.src = URL.createObjectURL(compressedBlob);
    img.onload = () => {
        compressedInfo.textContent = `文件大小: ${formatFileSize(compressedBlob.size)}\n`;
        compressedInfo.textContent += `压缩率: ${((1 - compressedBlob.size / file.size) * 100).toFixed(1)}%\n`;
        compressedInfo.textContent += `分辨率: ${img.width}x${img.height}`;
        URL.revokeObjectURL(img.src);
    };
    
    return compressedBlob;
}

// 更新事件监听器
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // 显示原图信息
        originalPreview.src = URL.createObjectURL(file);
        const originalImg = new Image();
        originalImg.src = originalPreview.src;
        originalImg.onload = () => {
            originalInfo.textContent = `文件大小: ${formatFileSize(file.size)}\n`;
            originalInfo.textContent += `分辨率: ${originalImg.width}x${originalImg.height}`;
        };

        // 压缩图片
        const quality = qualitySlider.value;
        const compressedBlob = await handleCompression(file, quality);
        compressedPreview.src = URL.createObjectURL(compressedBlob);
        downloadButton.disabled = false;
    } catch (error) {
        console.error('压缩过程出错:', error);
        alert('图片压缩失败，请重试');
    }
});

// 更新质量滑块变化的处理函数
qualitySlider.addEventListener('input', async (e) => {
    const quality = parseInt(e.target.value);
    qualityValue.textContent = quality + '%';
    
    if (!imageInput.files[0]) return;

    try {
        const file = imageInput.files[0];
        const keepOriginalSize = document.getElementById('keepSize').checked;
        const compressedBlob = await compressImage(file, quality, keepOriginalSize);
        
        // 更新预览
        compressedPreview.src = URL.createObjectURL(compressedBlob);
        
        // 获取压缩后的图片尺寸
        const img = new Image();
        img.src = compressedPreview.src;
        img.onload = () => {
            // 更新显示信息
            const compressionRatio = ((1 - compressedBlob.size / file.size) * 100).toFixed(1);
            compressedInfo.textContent = `文件大小: ${formatFileSize(compressedBlob.size)}\n`;
            compressedInfo.textContent += `压缩率: ${compressionRatio}%\n`;
            compressedInfo.textContent += `分辨率: ${img.width}x${img.height}`;
            URL.revokeObjectURL(img.src);
        };
    } catch (error) {
        console.error('压缩过程出错:', error);
    }
});

// 处理下载
downloadButton.addEventListener('click', async () => {
    try {
        const quality = qualitySlider.value;
        const compressedBlob = await compressImage(imageInput.files[0], quality);
        const url = URL.createObjectURL(compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compressed_' + imageInput.files[0].name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('下载过程出错:', error);
        alert('下载失败，请重试');
    }
}); 