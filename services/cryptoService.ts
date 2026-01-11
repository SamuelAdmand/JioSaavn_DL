import CryptoJS from 'crypto-js';

// The "Magic Key" from the reference repo
const DES_KEY = "38346591";

/**
 * Decrypts the JioSaavn encrypted media URL using DES-ECB.
 * This effectively ports `get_dec_url` from the Python reference.
 */
export const decryptUrl = (encryptedUrl: string): string => {
    if (!encryptedUrl) return '';

    try {
        const keyHex = CryptoJS.enc.Utf8.parse(DES_KEY);
        // Create a CipherParams object manually to satisfy the type definition
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl)
        });

        const decrypted = CryptoJS.DES.decrypt(
            cipherParams,
            keyHex,
            {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        const decryptedUrl = decrypted.toString(CryptoJS.enc.Utf8);

        // Upgrade quality logic from reference
        return decryptedUrl.replace('_96.mp4', '_320.mp4');
    } catch (e) {
        console.error("Failed to decrypt URL:", e);
        return '';
    }
};

/**
 * Transforms the low-res image URL to high-res (500x500).
 */
export const getHighResImage = (imageUrl: string): string => {
    if (!imageUrl) return '';
    // Replace 150x150.jpg or similar patterns with 500x500.jpg
    return imageUrl.replace(/-\d+x\d+\.(jpg|webp)/, '-500x500.jpg');
};
