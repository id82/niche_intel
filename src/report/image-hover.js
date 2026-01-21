/**
 * Image Hover Module
 * Cover image hover preview functionality
 */

import { getHoverTimeout, setHoverTimeout } from './state.js';

export function createImageHoverModal() {
    const modal = document.createElement('div');
    modal.id = 'image-hover-modal';
    modal.innerHTML = '<img src="" alt="Enlarged cover image">';
    document.body.appendChild(modal);
}

export function showImageModal(imageSrc, sourceElement) {
    const modal = document.getElementById('image-hover-modal');
    const img = modal.querySelector('img');

    img.src = imageSrc;

    const rect = sourceElement.getBoundingClientRect();
    const modalWidth = 220;
    const modalHeight = 300;
    const offset = 10;

    let left = rect.right + offset;
    let top = rect.top;

    if (left + modalWidth > window.innerWidth) {
        left = rect.left - modalWidth - offset;
    }

    if (top + modalHeight > window.innerHeight) {
        top = window.innerHeight - modalHeight - offset;
    }

    if (top < offset) {
        top = offset;
    }

    if (left < offset) {
        left = offset;
    }

    modal.style.left = left + 'px';
    modal.style.top = top + 'px';
    modal.style.display = 'block';
    modal.style.opacity = '1';
}

export function hideImageModal() {
    const modal = document.getElementById('image-hover-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 200);
}

export function addImageHoverEvents() {
    const coverImages = document.querySelectorAll('.cover-image');

    coverImages.forEach(img => {
        img.addEventListener('mouseenter', () => {
            if (img.src && img.src !== '') {
                const currentTimeout = getHoverTimeout();
                if (currentTimeout) {
                    clearTimeout(currentTimeout);
                }

                setHoverTimeout(setTimeout(() => {
                    showImageModal(img.src, img);
                }, 150));
            }
        });

        img.addEventListener('mouseleave', () => {
            const currentTimeout = getHoverTimeout();
            if (currentTimeout) {
                clearTimeout(currentTimeout);
                setHoverTimeout(null);
            }

            setTimeout(() => {
                hideImageModal();
            }, 100);
        });
    });

    const modal = document.getElementById('image-hover-modal');
    if (modal) {
        modal.addEventListener('mouseenter', () => {
            const currentTimeout = getHoverTimeout();
            if (currentTimeout) {
                clearTimeout(currentTimeout);
            }
        });

        modal.addEventListener('mouseleave', () => {
            hideImageModal();
        });
    }
}
