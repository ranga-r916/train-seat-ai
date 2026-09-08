"""
Seed popular local railway routes with 100+ bidirectional real trains.
Covers:
- Bengaluru <-> Chennai Central (via Bangarapet, Katpadi, etc.)
- Bengaluru <-> Mysuru Junction
- Bengaluru <-> Tumkur
- New Delhi <-> Mumbai Central
- New Delhi <-> Howrah Junction
- New Delhi <-> KSR Bengaluru
- Mumbai Central <-> Chennai Central
- Howrah Junction <-> Chennai Central
"""
from database import SessionLocal, engine, Base
import models
from models import Train, Coach, Seat, CoachType, SeatStatus, SeatZone
from datetime import time

def seed(db=None):
    close_when_done = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_when_done = True

    print("Seeding database with multiple trains across all corridors...")

    trains_config = [
        # ==========================================
        # Corridor 1: Bengaluru <-> Chennai Central
        # ==========================================
        # SBC -> MAS
        {"number": "12608", "name": "Lalbagh SF Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(6, 20), "arr_time": time(12, 15)},
        {"number": "12610", "name": "KSR Bengaluru - MGR Chennai Central SF Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(8, 0), "arr_time": time(14, 25)},
        {"number": "12578", "name": "Bagmati SF Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(13, 50), "arr_time": time(19, 45)},
        {"number": "22626", "name": "KSR Bengaluru - MGR Chennai Central Double Decker Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(14, 30), "arr_time": time(20, 35)},
        {"number": "20608", "name": "Mysuru - MGR Chennai Central Vande Bharat Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(14, 50), "arr_time": time(19, 20)},
        {"number": "12640", "name": "Brindavan Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(15, 10), "arr_time": time(21, 10)},
        {"number": "12008", "name": "Mysuru - MGR Chennai Central Shatabdi Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(16, 15), "arr_time": time(21, 30)},
        {"number": "12658", "name": "KSR Bengaluru - MGR Chennai Central Mail", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(22, 40), "arr_time": time(4, 20)},
        {"number": "12692", "name": "SSPN - MGR Chennai Central Superfast Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(23, 25), "arr_time": time(5, 15)},
        {"number": "22682", "name": "Mysuru - MGR Chennai Central Superfast Express", "source": "KSR Bengaluru", "dest": "Chennai Central", "dep_time": time(21, 15), "arr_time": time(3, 45)},

        # MAS -> SBC (Return)
        {"number": "12607", "name": "Lalbagh SF Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(15, 30), "arr_time": time(21, 35)},
        {"number": "12609", "name": "MGR Chennai Central - KSR Bengaluru SF Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(13, 35), "arr_time": time(20, 0)},
        {"number": "12577", "name": "Bagmati SF Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(7, 30), "arr_time": time(13, 20)},
        {"number": "22625", "name": "MGR Chennai Central - KSR Bengaluru Double Decker Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(7, 25), "arr_time": time(13, 10)},
        {"number": "20607", "name": "MGR Chennai Central - Mysuru Vande Bharat Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(5, 50), "arr_time": time(10, 15)},
        {"number": "12639", "name": "Brindavan Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(7, 40), "arr_time": time(13, 45)},
        {"number": "12007", "name": "MGR Chennai Central - Mysuru Shatabdi Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(6, 0), "arr_time": time(10, 45)},
        {"number": "12657", "name": "MGR Chennai Central - KSR Bengaluru Mail", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(22, 50), "arr_time": time(4, 30)},
        {"number": "12691", "name": "MGR Chennai Central - SSPN Superfast Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(23, 30), "arr_time": time(5, 30)},
        {"number": "22681", "name": "MGR Chennai Central - Mysuru Weekly Superfast Express", "source": "Chennai Central", "dest": "KSR Bengaluru", "dep_time": time(20, 30), "arr_time": time(3, 0)},

        # ==========================================
        # Corridor 2: Bengaluru <-> Mysuru Junction
        # ==========================================
        # SBC -> MYS
        {"number": "16021", "name": "Kaveri Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(3, 50), "arr_time": time(6, 40)},
        {"number": "16231", "name": "Mayiladuturai - Mysuru Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(5, 45), "arr_time": time(8, 0)},
        {"number": "16591", "name": "Hampi Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(6, 10), "arr_time": time(8, 50)},
        {"number": "16235", "name": "Tuticorin - Mysuru Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(7, 15), "arr_time": time(10, 10)},
        {"number": "20607-MYS", "name": "MGR Chennai - Mysuru Vande Bharat Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(10, 20), "arr_time": time(12, 20)},
        {"number": "12007-MYS", "name": "MGR Chennai - Mysuru Shatabdi Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(10, 45), "arr_time": time(13, 0)},
        {"number": "16558", "name": "Rajya Rani Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(11, 30), "arr_time": time(14, 0)},
        {"number": "12976", "name": "Jaipur - Mysuru Superfast Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(13, 0), "arr_time": time(15, 30)},
        {"number": "12614", "name": "Wodeyar SF Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(15, 15), "arr_time": time(17, 45)},
        {"number": "16216", "name": "Chamundi Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(18, 15), "arr_time": time(21, 5)},
        {"number": "12609-MYS", "name": "MGR Chennai Central - Mysuru SF Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(19, 50), "arr_time": time(22, 50)},
        {"number": "16227-MYS", "name": "Bengaluru - Mysuru Express", "source": "KSR Bengaluru", "dest": "Mysuru Junction", "dep_time": time(22, 0), "arr_time": time(0, 30)},

        # MYS -> SBC (Return)
        {"number": "16022", "name": "Kaveri Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(21, 0), "arr_time": time(23, 45)},
        {"number": "16232", "name": "Mysuru - Mayiladuturai Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(16, 15), "arr_time": time(18, 45)},
        {"number": "16592", "name": "Hampi Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(18, 50), "arr_time": time(21, 40)},
        {"number": "16236", "name": "Mysuru - Tuticorin Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(18, 20), "arr_time": time(21, 5)},
        {"number": "20608-MYS", "name": "Mysuru - MGR Chennai Vande Bharat Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(13, 5), "arr_time": time(14, 45)},
        {"number": "12008-MYS", "name": "Mysuru - MGR Chennai Shatabdi Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(14, 15), "arr_time": time(16, 10)},
        {"number": "16557", "name": "Rajya Rani Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(14, 30), "arr_time": time(17, 15)},
        {"number": "12975", "name": "Mysuru - Jaipur Superfast Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(10, 30), "arr_time": time(13, 0)},
        {"number": "12613", "name": "Wodeyar SF Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(6, 45), "arr_time": time(9, 15)},
        {"number": "16215", "name": "Chamundi Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(6, 45), "arr_time": time(9, 35)},
        {"number": "12610-MYS", "name": "Mysuru - Chennai Central SF Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(5, 0), "arr_time": time(7, 45)},
        {"number": "16228-MYS", "name": "Mysuru - Bengaluru Express", "source": "Mysuru Junction", "dest": "KSR Bengaluru", "dep_time": time(7, 0), "arr_time": time(9, 30)},

        # ==========================================
        # Corridor 3: Bengaluru <-> Tumkur
        # ==========================================
        # SBC -> TK
        {"number": "12079", "name": "KSR Bengaluru - SSS Hubballi Jan Shatabdi Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(6, 0), "arr_time": time(7, 0)},
        {"number": "17326", "name": "Vishwa Manava Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(8, 45), "arr_time": time(10, 3)},
        {"number": "16579", "name": "Yesvantpur - Shivamogga Town InterCity Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(9, 15), "arr_time": time(10, 14)},
        {"number": "06571", "name": "KSR Bengaluru - Tumakuru MEMU Special", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(9, 20), "arr_time": time(10, 55)},
        {"number": "17316", "name": "Velankanni - Vasco Da Gama Weekly Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(11, 35), "arr_time": time(12, 40)},
        {"number": "12725", "name": "Siddhaganga InterCity SF Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(12, 45), "arr_time": time(13, 48)},
        {"number": "06575", "name": "KSR Bengaluru - Tumakuru MEMU Special", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(13, 50), "arr_time": time(15, 20)},
        {"number": "12629", "name": "Karnataka Sampark Kranti Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(14, 30), "arr_time": time(15, 24)},
        {"number": "17309", "name": "Yesvantpur - Vasco Da Gama Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(15, 0), "arr_time": time(15, 58)},
        {"number": "16535", "name": "Gol Gumbaz Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(18, 30), "arr_time": time(19, 40)},
        {"number": "16589", "name": "Rani Chennamma Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(23, 0), "arr_time": time(23, 59)},
        {"number": "16227", "name": "Bengaluru - Talguppa Express", "source": "KSR Bengaluru", "dest": "Tumkur", "dep_time": time(23, 15), "arr_time": time(0, 30)},

        # TK -> SBC (Return)
        {"number": "12080", "name": "SSS Hubballi - KSR Bengaluru Jan Shatabdi Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(20, 10), "arr_time": time(21, 15)},
        {"number": "17325", "name": "Vishwa Manava Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(17, 40), "arr_time": time(19, 0)},
        {"number": "16580", "name": "Shivamogga Town - Yesvantpur InterCity Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(19, 5), "arr_time": time(20, 15)},
        {"number": "06572", "name": "Tumakuru - KSR Bengaluru MEMU Special", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(6, 50), "arr_time": time(8, 25)},
        {"number": "17315", "name": "Vasco Da Gama - Velankanni Weekly Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(23, 10), "arr_time": time(0, 15)},
        {"number": "12726", "name": "Siddhaganga InterCity SF Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(8, 20), "arr_time": time(9, 30)},
        {"number": "06576", "name": "Tumakuru - KSR Bengaluru MEMU Special", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(11, 15), "arr_time": time(12, 50)},
        {"number": "12630", "name": "Karnataka Sampark Kranti Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(4, 30), "arr_time": time(5, 45)},
        {"number": "17310", "name": "Vasco Da Gama - Yesvantpur Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(11, 0), "arr_time": time(12, 5)},
        {"number": "16536", "name": "Gol Gumbaz Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(6, 5), "arr_time": time(7, 15)},
        {"number": "16590", "name": "Rani Chennamma Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(5, 0), "arr_time": time(6, 15)},
        {"number": "16228", "name": "Talguppa - Bengaluru Express", "source": "Tumkur", "dest": "KSR Bengaluru", "dep_time": time(4, 0), "arr_time": time(5, 15)},

        # ==========================================
        # Corridor 4: New Delhi <-> Mumbai Central
        # ==========================================
        # NDLS -> MMCT
        {"number": "12952", "name": "Mumbai Rajdhani Express", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(16, 55), "arr_time": time(8, 35)},
        {"number": "12954", "name": "August Kranti Tejas Rajdhani Express", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(17, 15), "arr_time": time(10, 5)},
        {"number": "12910", "name": "Hazrat Nizamuddin - Bandra Garib Rath", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(15, 35), "arr_time": time(7, 35)},
        {"number": "12926", "name": "Paschim Express", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(16, 35), "arr_time": time(14, 55)},
        {"number": "12956", "name": "Jaipur - Mumbai Central SF Express", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(14, 0), "arr_time": time(6, 55)},
        {"number": "22210", "name": "New Delhi - Mumbai Central AC Duronto", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(23, 25), "arr_time": time(15, 50)},
        {"number": "12472", "name": "Swaraj SF Express", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(21, 40), "arr_time": time(16, 10)},
        {"number": "12904", "name": "Golden Temple Mail", "source": "New Delhi", "dest": "Mumbai Central", "dep_time": time(7, 20), "arr_time": time(5, 20)},

        # MMCT -> NDLS (Return)
        {"number": "12951", "name": "Mumbai Rajdhani Express", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(17, 0), "arr_time": time(8, 32)},
        {"number": "12953", "name": "August Kranti Tejas Rajdhani Express", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(17, 10), "arr_time": time(9, 43)},
        {"number": "12909", "name": "Bandra - Hazrat Nizamuddin Garib Rath", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(17, 30), "arr_time": time(9, 40)},
        {"number": "12925", "name": "Paschim Express", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(11, 25), "arr_time": time(10, 40)},
        {"number": "12955", "name": "Mumbai Central - Jaipur SF Express", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(19, 5), "arr_time": time(12, 0)},
        {"number": "22209", "name": "Mumbai Central - New Delhi AC Duronto", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(23, 10), "arr_time": time(15, 55)},
        {"number": "12471", "name": "Swaraj SF Express", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(11, 0), "arr_time": time(5, 25)},
        {"number": "12903", "name": "Golden Temple Mail", "source": "Mumbai Central", "dest": "New Delhi", "dep_time": time(18, 45), "arr_time": time(17, 5)},

        # ==========================================
        # Corridor 5: New Delhi <-> Howrah Junction
        # ==========================================
        # NDLS -> HWH
        {"number": "12302", "name": "Howrah Rajdhani Express (via Gaya)", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(16, 50), "arr_time": time(9, 55)},
        {"number": "12306", "name": "Howrah Rajdhani Express (via Patna)", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(16, 50), "arr_time": time(12, 15)},
        {"number": "12314", "name": "Sealdah Rajdhani Express", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(16, 30), "arr_time": time(10, 10)},
        {"number": "12304", "name": "Poorva Express (via Patna)", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(17, 40), "arr_time": time(17, 0)},
        {"number": "12382", "name": "Poorva Express (via Gaya)", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(17, 40), "arr_time": time(17, 0)},
        {"number": "12274", "name": "Howrah AC Duronto Express", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(12, 40), "arr_time": time(6, 20)},
        {"number": "12312", "name": "Netaji Express", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(6, 15), "arr_time": time(8, 5)},
        {"number": "12496", "name": "Pratap SF Express", "source": "New Delhi", "dest": "Howrah Junction", "dep_time": time(18, 25), "arr_time": time(13, 5)},

        # HWH -> NDLS (Return)
        {"number": "12301", "name": "Howrah Rajdhani Express (via Gaya)", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(16, 50), "arr_time": time(10, 5)},
        {"number": "12305", "name": "Howrah Rajdhani Express (via Patna)", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(14, 5), "arr_time": time(10, 20)},
        {"number": "12313", "name": "Sealdah Rajdhani Express", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(16, 50), "arr_time": time(10, 30)},
        {"number": "12303", "name": "Poorva Express (via Patna)", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(8, 0), "arr_time": time(6, 0)},
        {"number": "12381", "name": "Poorva Express (via Gaya)", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(8, 15), "arr_time": time(6, 5)},
        {"number": "12273", "name": "Howrah AC Duronto Express", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(8, 35), "arr_time": time(6, 25)},
        {"number": "12311", "name": "Netaji Express", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(21, 55), "arr_time": time(20, 55)},
        {"number": "12495", "name": "Pratap SF Express", "source": "Howrah Junction", "dest": "New Delhi", "dep_time": time(22, 50), "arr_time": time(17, 35)},

        # ==========================================
        # Corridor 6: New Delhi <-> KSR Bengaluru
        # ==========================================
        # NDLS -> SBC
        {"number": "22692", "name": "Bengaluru Rajdhani Express", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(20, 45), "arr_time": time(6, 40)},
        {"number": "12628", "name": "Karnataka Express", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(20, 20), "arr_time": time(12, 0)},
        {"number": "12650", "name": "Karnataka Sampark Kranti Express", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(6, 40), "arr_time": time(19, 0)},
        {"number": "22686", "name": "Chandigarh - Yesvantpur Sampark Kranti", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(8, 10), "arr_time": time(18, 25)},
        {"number": "12214", "name": "Delhi Sarai Rohilla - Yesvantpur AC Duronto", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(23, 0), "arr_time": time(15, 40)},
        {"number": "12494", "name": "Hazrat Nizamuddin - Bengaluru SF Express", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(21, 40), "arr_time": time(19, 50)},
        {"number": "12630", "name": "Hazrat Nizamuddin - Yesvantpur Sampark Kranti", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(8, 30), "arr_time": time(5, 45)},
        {"number": "22694", "name": "Hazrat Nizamuddin - Bengaluru Premium SF", "source": "New Delhi", "dest": "KSR Bengaluru", "dep_time": time(20, 45), "arr_time": time(6, 40)},

        # SBC -> NDLS (Return)
        {"number": "22691", "name": "Bengaluru Rajdhani Express", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(20, 0), "arr_time": time(5, 55)},
        {"number": "12627", "name": "Karnataka Express", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(19, 20), "arr_time": time(10, 30)},
        {"number": "12649", "name": "Karnataka Sampark Kranti Express", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(13, 50), "arr_time": time(2, 40)},
        {"number": "22685", "name": "Yesvantpur - Chandigarh Sampark Kranti", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(14, 30), "arr_time": time(0, 50)},
        {"number": "12213", "name": "Yesvantpur - Delhi Sarai Rohilla AC Duronto", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(23, 40), "arr_time": time(16, 50)},
        {"number": "12493", "name": "Bengaluru - Hazrat Nizamuddin SF Express", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(17, 20), "arr_time": time(15, 45)},
        {"number": "12629-NDLS", "name": "Yesvantpur - Hazrat Nizamuddin Sampark Kranti", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(14, 30), "arr_time": time(11, 40)},
        {"number": "22693", "name": "Bengaluru - Hazrat Nizamuddin Premium SF", "source": "KSR Bengaluru", "dest": "New Delhi", "dep_time": time(20, 0), "arr_time": time(5, 55)},

        # ==========================================
        # Corridor 7: Mumbai Central <-> Chennai Central
        # ==========================================
        # MMCT -> MAS
        {"number": "12163", "name": "Mumbai Chennai Express", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(18, 45), "arr_time": time(16, 30)},
        {"number": "22157", "name": "Mumbai CSMT - Chennai Central Superfast", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(22, 55), "arr_time": time(22, 15)},
        {"number": "22159", "name": "Mumbai CSMT - Chennai Central Mail", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(12, 45), "arr_time": time(10, 45)},
        {"number": "11041", "name": "Mumbai CSMT - Chennai Central Express", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(14, 0), "arr_time": time(16, 40)},
        {"number": "11073", "name": "Lokmanya Tilak - Chennai Central Weekly", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(15, 50), "arr_time": time(13, 0)},
        {"number": "12219", "name": "LTT - Secunderabad - Chennai AC Duronto", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(23, 5), "arr_time": time(11, 10)},
        {"number": "16351", "name": "Mumbai CSMT - Nagercoil Balaji Express", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(12, 10), "arr_time": time(15, 20)},
        {"number": "16339", "name": "Mumbai CSMT - Nagercoil Express", "source": "Mumbai Central", "dest": "Chennai Central", "dep_time": time(20, 35), "arr_time": time(23, 45)},

        # MAS -> MMCT (Return)
        {"number": "12164", "name": "Chennai Mumbai Express", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(18, 20), "arr_time": time(15, 40)},
        {"number": "22158", "name": "Chennai Central - Mumbai CSMT Superfast", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(6, 20), "arr_time": time(5, 50)},
        {"number": "22160", "name": "Chennai Central - Mumbai CSMT Mail", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(13, 25), "arr_time": time(12, 30)},
        {"number": "11042", "name": "Chennai Central - Mumbai CSMT Express", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(12, 25), "arr_time": time(14, 25)},
        {"number": "11074", "name": "Chennai Central - Lokmanya Tilak Weekly", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(15, 15), "arr_time": time(12, 45)},
        {"number": "12220", "name": "Chennai - LTT AC Duronto Express", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(23, 5), "arr_time": time(11, 5)},
        {"number": "16352", "name": "Nagercoil - Mumbai CSMT Balaji Express", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(6, 0), "arr_time": time(8, 35)},
        {"number": "16340", "name": "Nagercoil - Mumbai CSMT Express", "source": "Chennai Central", "dest": "Mumbai Central", "dep_time": time(6, 0), "arr_time": time(9, 30)},

        # ==========================================
        # Corridor 8: Howrah Junction <-> Chennai Central
        # ==========================================
        # HWH -> MAS
        {"number": "12841", "name": "Coromandel Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(15, 20), "arr_time": time(17, 0)},
        {"number": "12839", "name": "Howrah - MGR Chennai Central Mail", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(23, 55), "arr_time": time(3, 50)},
        {"number": "22825", "name": "Shalimar - MGR Chennai Central Weekly SF Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(12, 20), "arr_time": time(14, 10)},
        {"number": "22807", "name": "Santragachi - MGR Chennai Central AC SF Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(18, 0), "arr_time": time(20, 15)},
        {"number": "12663", "name": "Howrah - Tiruchchirappalli Superfast Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(17, 40), "arr_time": time(20, 10)},
        {"number": "12863", "name": "Howrah - Sir M. Visvesvaraya Terminal SF Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(22, 55), "arr_time": time(6, 45)},
        {"number": "22855", "name": "Santragachi - Tirupati Weekly SF Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(14, 55), "arr_time": time(16, 35)},
        {"number": "22841", "name": "Santragachi - MGR Chennai Central Antyodaya Express", "source": "Howrah Junction", "dest": "Chennai Central", "dep_time": time(18, 0), "arr_time": time(20, 45)},

        # MAS -> HWH (Return)
        {"number": "12842", "name": "Coromandel Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(7, 0), "arr_time": time(8, 45)},
        {"number": "12840", "name": "MGR Chennai Central - Howrah Mail", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(19, 0), "arr_time": time(23, 0)},
        {"number": "22826", "name": "MGR Chennai Central - Shalimar Weekly SF Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(16, 20), "arr_time": time(18, 15)},
        {"number": "22808", "name": "MGR Chennai Central - Santragachi AC SF Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(8, 10), "arr_time": time(10, 25)},
        {"number": "12664", "name": "Tiruchchirappalli - Howrah Superfast Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(13, 30), "arr_time": time(15, 45)},
        {"number": "12864", "name": "Sir M. Visvesvaraya - Howrah SF Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(10, 35), "arr_time": time(18, 25)},
        {"number": "22856", "name": "Tirupati - Santragachi Weekly SF Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(19, 55), "arr_time": time(21, 40)},
        {"number": "22842", "name": "MGR Chennai Central - Santragachi Antyodaya Express", "source": "Chennai Central", "dest": "Howrah Junction", "dep_time": time(7, 45), "arr_time": time(10, 30)},
    ]

    # Coach configuration per train (A, B = 3A, C, D = SL, E, F = 2S)
    coach_config = [
        ("A", CoachType.SENIOR_DISABLED, 64),
        ("B", CoachType.LADIES, 64),
        ("C", CoachType.GENERAL, 72),
        ("D", CoachType.GENERAL, 72),
        ("E", CoachType.GENERAL, 72),
        ("F", CoachType.GENERAL, 72),
    ]

    added_trains = 0
    for t_info in trains_config:
        existing = db.query(Train).filter(Train.train_number == t_info["number"]).first()
        if existing:
            continue

        train = Train(
            train_number=t_info["number"],
            train_name=t_info["name"],
            source_station=t_info["source"],
            destination_station=t_info["dest"],
            departure_time=t_info["dep_time"],
            arrival_time=t_info["arr_time"],
            is_active=True
        )
        db.add(train)
        db.flush()
        added_trains += 1

        all_seats = []
        for coach_letter, coach_type, total_seats in coach_config:
            coach = Coach(
                train_id=train.id,
                coach_number=coach_letter,
                coach_type=coach_type,
                total_seats=total_seats
            )
            db.add(coach)
            db.flush()

            for i in range(1, total_seats + 1):
                seat_number = f"{coach_letter}-{i:02d}"
                row_number = (i - 1) // 8 + 1

                if coach_letter == "A" and row_number <= 4:
                    zone = SeatZone.PRIORITY_1_2
                elif coach_letter == "B":
                    zone = SeatZone.PRIORITY_3
                else:
                    zone = SeatZone.GENERAL

                seat = Seat(
                    coach_id=coach.id,
                    seat_number=seat_number,
                    row_number=row_number,
                    seat_zone=zone,
                    status=SeatStatus.AVAILABLE
                )
                all_seats.append(seat)
        db.add_all(all_seats)
        db.commit()

    # Seed default user accounts so they work instantly on fresh cloud databases
    from models.user import User, UserRole, PriorityLevel
    default_users = [
        {
            "name": "Ranganath R",
            "email": "rangaso3652@gmail.com",
            "mobile": "9876543210",
            "hashed_password": "$2b$12$gCpmMHD0FfYg1CVZGbLTQebqDhKUOco.LOybxi.ZLYcD6vH27r9Cq",
            "role": UserRole.PASSENGER,
            "priority": PriorityLevel.P4_GENERAL,
            "aadhaar_verified": True
        },
        {
            "name": "Vinutha K S",
            "email": "ksvinutha12@gmail.com",
            "mobile": "9876543211",
            "hashed_password": "$2b$12$G05pWEp6qu8E562i5qmz0uHC8/MylqjHvxw49is917csB9ezRpIm2",
            "role": UserRole.PASSENGER,
            "priority": PriorityLevel.P4_GENERAL,
            "aadhaar_verified": True
        },
        {
            "name": "Ranganath",
            "email": "ranganathr8904@gmail.com",
            "mobile": "9876543212",
            "hashed_password": "$2b$12$gCpmMHD0FfYg1CVZGbLTQebqDhKUOco.LOybxi.ZLYcD6vH27r9Cq",
            "role": UserRole.ADMIN,
            "priority": PriorityLevel.P4_GENERAL,
            "aadhaar_verified": True
        }
    ]
    for u_info in default_users:
        if not db.query(User).filter(User.email == u_info["email"]).first():
            u = User(**u_info)
            db.add(u)

    db.commit()
    total_trains = db.query(Train).count()
    if close_when_done:
        db.close()
    print(f"Database seeding complete! Added {added_trains} new trains. Total trains in DB: {total_trains}")

if __name__ == "__main__":
    seed()
