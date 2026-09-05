import qrcode
from PIL import Image

url = "https://slides-bizarre-basis-rural.trycloudflare.com/login"
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("mobile_booking_qr.png")
print("QR Code generated successfully!")
