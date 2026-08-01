import pandas as pd
import random
import datetime

def generate_mock_cdr(file_path: str = "mock_cdr.csv"):
    # Target suspect phone number
    suspect_num = "+919876543210"
    accomplice_num = "+919123456789"
    other_numbers = [
        f"+9198{random.randint(10000000, 99999999)}" for _ in range(20)
    ]
    
    # Handsets used by suspect
    imei_old = "860431045551234"
    imei_new = "359871109988776" # Handset change
    
    imsi = "404459876543210"
    
    # Cell Tower IDs
    crime_scene_tower = "CGI-404-45-11009-8877" # Sector 5, Kolkata
    home_tower = "CGI-404-45-11009-1122"       # Salt Lake Block C
    other_towers = [f"CGI-404-45-11009-{random.randint(1000, 9999)}" for _ in range(10)]
    
    records = []
    
    # Generate calls over a 5-day span around the "crime day" (July 15, 2026)
    start_date = datetime.datetime(2026, 7, 13, 0, 0, 0)
    
    for i in range(500):
        # Time increment
        delta_minutes = random.randint(5, 45)
        delta_seconds = random.randint(0, 59)
        start_date += datetime.timedelta(minutes=delta_minutes, seconds=delta_seconds)
        
        # Decide if this is a suspect call or general call
        is_suspect = random.random() < 0.25
        
        # IMEI swap happens on July 14, 2026 at 18:00
        current_imei = imei_old
        if start_date > datetime.datetime(2026, 7, 14, 18, 0, 0):
            current_imei = imei_new
            
        if is_suspect:
            a_party = suspect_num
            # 60% call accomplice, 40% call random
            if random.random() < 0.6:
                b_party = accomplice_num
            else:
                b_party = random.choice(other_numbers)
                
            # Suspect is near home tower most times, but near crime scene tower on July 15 between 09:30 and 12:30
            if datetime.datetime(2026, 7, 15, 9, 30) <= start_date <= datetime.datetime(2026, 7, 15, 12, 30):
                cell_id = crime_scene_tower
            else:
                cell_id = home_tower if random.random() < 0.8 else random.choice(other_towers)
                
            call_type = random.choice(["VOICE", "VOICE", "SMS"])
            duration = random.randint(10, 450) if call_type == "VOICE" else 0
            
            records.append({
                "Calling Number": a_party,
                "Called Number": b_party,
                "Start Time": start_date.strftime("%Y-%m-%d %H:%M:%S"),
                "Duration (sec)": duration,
                "Call Type": call_type,
                "IMEI": current_imei,
                "IMSI": imsi,
                "Cell Tower ID": cell_id
            })
        else:
            # Random calls not involving suspect
            a_party = random.choice(other_numbers)
            b_party = random.choice(other_numbers)
            while b_party == a_party:
                b_party = random.choice(other_numbers)
            
            cell_id = random.choice(other_towers)
            call_type = random.choice(["VOICE", "VOICE", "SMS", "DATA"])
            duration = random.randint(10, 300) if call_type == "VOICE" else 0
            
            records.append({
                "Calling Number": a_party,
                "Called Number": b_party,
                "Start Time": start_date.strftime("%Y-%m-%d %H:%M:%S"),
                "Duration (sec)": duration,
                "Call Type": call_type,
                "IMEI": f"86043104{random.randint(100000, 999999)}",
                "IMSI": f"40445{random.randint(1000000000, 9999999999)}",
                "Cell Tower ID": cell_id
            })
            
    # Inject specific crime-timeline calls
    # Crime happened on July 15, 2026 at 10:45 AM. Suspect calls accomplice right after at 10:50 AM
    records.append({
        "Calling Number": suspect_num,
        "Called Number": accomplice_num,
        "Start Time": "2026-07-15 10:50:12",
        "Duration (sec)": 180,
        "Call Type": "VOICE",
        "IMEI": imei_new,
        "IMSI": imsi,
        "Cell Tower ID": crime_scene_tower
    })
    
    # Suspect calls accomplice at 02:15 AM (nighttime call) on July 15
    records.append({
        "Calling Number": suspect_num,
        "Called Number": accomplice_num,
        "Start Time": "2026-07-15 02:15:44",
        "Duration (sec)": 45,
        "Call Type": "VOICE",
        "IMEI": imei_new,
        "IMSI": imsi,
        "Cell Tower ID": home_tower
    })
    
    df = pd.DataFrame(records)
    # Sort by Start Time
    df["dt"] = pd.to_datetime(df["Start Time"])
    df = df.sort_values(by="dt").drop(columns=["dt"])
    
    df.to_csv(file_path, index=False)
    print(f"Generated mock CDR CSV with {len(df)} records at {file_path}")

if __name__ == "__main__":
    generate_mock_cdr()
