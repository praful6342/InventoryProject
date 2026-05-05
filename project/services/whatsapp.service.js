const axios = require('axios');
const FormData = require('form-data');

class WhatsAppService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.apiVersion = 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
        this.mediaUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;
    }

    /**
     * Send a PDF document via WhatsApp
     * @param {string} toPhoneNumber - Customer's phone number (with country code, digits only)
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @param {string} filename - Name of the PDF file (e.g., Bill_BILL-123.pdf)
     * @param {string} caption - Optional caption/message
     * @returns {Promise<Object>} WhatsApp API response
     */
    async sendDocument(toPhoneNumber, pdfBuffer, filename, caption = '') {
        try {
            // Validate required environment variables
            if (!this.accessToken || !this.phoneNumberId) {
                throw new Error('WhatsApp credentials missing. Check .env file.');
            }

            // Step 1: Upload the PDF to get a media ID
            const mediaId = await this.uploadMedia(pdfBuffer, filename);
            if (!mediaId) throw new Error('Failed to upload media to WhatsApp');

            // Step 2: Send the document message
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: this.formatPhoneNumber(toPhoneNumber),
                type: 'document',
                document: {
                    id: mediaId,
                    caption: caption || 'Thank you for your purchase! Your bill is attached.',
                    filename: filename
                }
            };

            const response = await axios.post(this.baseUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('WhatsApp send error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload a PDF file to WhatsApp media endpoint
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @param {string} filename - Desired file name
     * @returns {Promise<string>} Media ID
     */
    async uploadMedia(pdfBuffer, filename) {
        const form = new FormData();
        form.append('file', pdfBuffer, {
            filename: filename,
            contentType: 'application/pdf'
        });
        form.append('type', 'document');
        form.append('messaging_product', 'whatsapp');

        const response = await axios.post(this.mediaUrl, form, {
            headers: {
                ...form.getHeaders(),
                                          'Authorization': `Bearer ${this.accessToken}`
            }
        });

        return response.data.id;
    }

    /**
     * Format phone number to international format without '+' or special chars
     * @param {string} phone - Raw phone input (e.g., +919876543210 or 9876543210)
     * @returns {string} Formatted phone (e.g., 919876543210)
     */
    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        // If number starts with 0, remove it (assuming country code follows)
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        // Ensure number has country code (minimum 10 digits)
        if (cleaned.length < 10) {
            throw new Error('Invalid phone number: too short');
        }
        return cleaned;
    }
}

module.exports = new WhatsAppService();
