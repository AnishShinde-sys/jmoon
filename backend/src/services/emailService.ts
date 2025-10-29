import nodemailer from 'nodemailer'

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendCollaboratorInvitation(
  inviteeEmail: string,
  inviterName: string,
  farmName: string,
  role: string,
  farmId: string
) {
  const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/farm/${farmId}`
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'hello@example.com', // Replace with your verified email
    to: inviteeEmail,
    subject: `You've been invited to collaborate on ${farmName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6e59c7;">You've been invited to ${farmName}</h2>
        <p>${inviterName} has invited you to collaborate on the farm "${farmName}" with ${role} permissions.</p>
        <p>Click the button below to access the farm:</p>
        <a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #6e59c7; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Access Farm
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${invitationLink}">${invitationLink}</a>
        </p>
      </div>
    `,
    text: `
      ${inviterName} has invited you to collaborate on the farm "${farmName}" with ${role} permissions.
      
      Click here to access the farm: ${invitationLink}
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

export async function sendSignupInvitation(
  inviteeEmail: string,
  inviterName: string,
  farmName: string,
  role?: string
) {
  const signupLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?email=${encodeURIComponent(inviteeEmail)}&inviter=${encodeURIComponent(inviterName)}&farm=${encodeURIComponent(farmName)}&role=${encodeURIComponent(role || 'collaborator')}`
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'hello@example.com', // Replace with your verified email
    to: inviteeEmail,
    subject: `Join ${farmName} on Budbase`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6e59c7;">Welcome to Budbase!</h2>
        <p>${inviterName} has invited you to collaborate on the farm "${farmName}".</p>
        <p>First, you'll need to create an account:</p>
        <a href="${signupLink}" style="display: inline-block; padding: 12px 24px; background-color: #6e59c7; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Create Account
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${signupLink}">${signupLink}</a>
        </p>
      </div>
    `,
    text: `
      ${inviterName} has invited you to collaborate on the farm "${farmName}".
      
      Create your account here: ${signupLink}
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Signup invitation sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending signup invitation:', error)
    return { success: false, error }
  }
}

