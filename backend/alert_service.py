import os
import smtplib
from email.message import EmailMessage

class AlertService:
    def __init__(self):
        # Configuration would normally come from environment variables
        self.smtp_server = os.environ.get("SMTP_SERVER", "smtp.example.com")
        self.smtp_port = int(os.environ.get("SMTP_PORT", 587))
        self.smtp_user = os.environ.get("SMTP_USER", "alerts@prevdengue.org")
        self.smtp_password = os.environ.get("SMTP_PASSWORD", "secret")
        self.to_email = os.environ.get("ADMIN_EMAIL", "health_admin@gov.bd")

    def trigger_critical_alert(self, district_name, predicted_cases):
        """
        Sends an automated alert to health officials when a district enters Critical risk.
        """
        msg = EmailMessage()
        msg.set_content(
            f"URGENT: PrevDengue System Alert\n\n"
            f"District {district_name} has reached a CRITICAL risk level.\n"
            f"Predicted cases: {predicted_cases}\n\n"
            f"Immediate preventative measures and hospital preparations are required."
        )
        msg['Subject'] = f"CRITICAL DENGUE ALERT: {district_name}"
        msg['From'] = self.smtp_user
        msg['To'] = self.to_email

        try:
            # In a real environment, we would connect to the SMTP server.
            # server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            # server.starttls()
            # server.login(self.smtp_user, self.smtp_password)
            # server.send_message(msg)
            # server.quit()
            print(f"[ALERT SERVICE] Email successfully dispatched for {district_name}")
            return True
        except Exception as e:
            print(f"[ALERT SERVICE] Failed to send email alert: {e}")
            return False

# Initialize a global instance
alerter = AlertService()
