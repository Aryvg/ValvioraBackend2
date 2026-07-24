const sendMail = async (mailOptions) => {
    const { from, to, subject, text, html } = mailOptions || {};

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                email: from || process.env.EMAIL_USER,
                name: process.env.EMAIL_SENDER_NAME || 'YouTube'
            },
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Brevo sendMail failed with status ${response.status}: ${errorBody}`);
    }
};

module.exports = {
    sendMail
};
