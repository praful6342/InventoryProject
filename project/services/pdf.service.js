const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');

class PDFService {
    /**
     * Generate a PDF bill from sale data
     * @param {Object} saleData - Sale object (including payments, totalPaid, etc.)
     * @param {Array} itemsData - Sale items array
     * @param {Object} user - Currently logged-in user (for navbar display)
     * @returns {Promise<Buffer>} PDF buffer
     */
    async generateBillPDF(saleData, itemsData, user = null) {
        let browser = null;
        try {
            // Launch Puppeteer (headless browser)
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for Linux environments
            });

            const page = await browser.newPage();

            // Prepare data for the bill template
            // Ensure payments and totalPaid are available
            const payments = saleData.payments || [];
            const totalPaid = saleData.totalPaid || payments.reduce((sum, p) => sum + p.amount, 0);
            const showChange = totalPaid > saleData.total_amount && saleData.total_amount > 0;
            const changeAmount = showChange ? (totalPaid - saleData.total_amount).toFixed(2) : 0;

            // Render bill.ejs template to HTML
            const html = await ejs.renderFile(
                path.join(__dirname, '../views/bill.ejs'),
                                              {
                                                  sale: saleData,
                                                  items: itemsData,
                                                  user: user,
                                                  payments: payments,
                                                  totalPaid: totalPaid.toFixed(2),
                                              showChange: showChange,
                                              changeAmount: changeAmount
                                              },
                                              { async: true }
            );

            // Set HTML content and generate PDF
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                    printBackground: true,
                    margin: {
                        top: '20px',
                        bottom: '20px',
                        left: '20px',
                        right: '20px'
                    }
            });

            return pdfBuffer;
        } catch (error) {
            console.error('PDF generation error:', error);
            throw new Error('Failed to generate PDF bill');
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = new PDFService();
