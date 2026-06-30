import CryptoJS from "crypto-js";

// Decrypt data
export const decryptData = (cipherText: string): string => {
    const bytes = CryptoJS.AES.decrypt(
        cipherText,
        process.env.CRYPTO_ENCRYPTION_KEY || ""
    );
    return bytes.toString(CryptoJS.enc.Utf8);
};
