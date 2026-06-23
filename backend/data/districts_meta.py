"""Static reference metadata for Bangladesh's 64 districts.

District names match the `shapeName` field in the geoBoundaries ADM2 GeoJSON
(BBS / OCHA source). Division assignments follow the current 8-division
administrative structure of Bangladesh.
"""
from __future__ import annotations

# District -> Division (8 divisions, 64 districts)
DIVISION_MAP: dict[str, str] = {
    # Dhaka (13)
    "Dhaka": "Dhaka", "Faridpur": "Dhaka", "Gazipur": "Dhaka",
    "Gopalganj": "Dhaka", "Kishoreganj": "Dhaka", "Madaripur": "Dhaka",
    "Manikganj": "Dhaka", "Munshiganj": "Dhaka", "Narayanganj": "Dhaka",
    "Narsingdi": "Dhaka", "Rajbari": "Dhaka", "Shariatpur": "Dhaka",
    "Tangail": "Dhaka",
    # Chittagong (11)
    "Bandarban": "Chittagong", "Brahamanbaria": "Chittagong",
    "Chandpur": "Chittagong", "Chittagong": "Chittagong", "Comilla": "Chittagong",
    "Cox's Bazar": "Chittagong", "Feni": "Chittagong", "Khagrachhari": "Chittagong",
    "Lakshmipur": "Chittagong", "Noakhali": "Chittagong", "Rangamati": "Chittagong",
    # Rajshahi (8)
    "Bogra": "Rajshahi", "Joypurhat": "Rajshahi", "Naogaon": "Rajshahi",
    "Natore": "Rajshahi", "Nawabganj": "Rajshahi", "Pabna": "Rajshahi",
    "Rajshahi": "Rajshahi", "Sirajganj": "Rajshahi",
    # Khulna (10)
    "Bagerhat": "Khulna", "Chuadanga": "Khulna", "Jessore": "Khulna",
    "Jhenaidah": "Khulna", "Khulna": "Khulna", "Kushtia": "Khulna",
    "Magura": "Khulna", "Meherpur": "Khulna", "Narail": "Khulna",
    "Satkhira": "Khulna",
    # Barisal (6)
    "Barguna": "Barisal", "Barisal": "Barisal", "Bhola": "Barisal",
    "Jhalokati": "Barisal", "Patuakhali": "Barisal", "Pirojpur": "Barisal",
    # Sylhet (4)
    "Habiganj": "Sylhet", "Maulvibazar": "Sylhet", "Sunamganj": "Sylhet",
    "Sylhet": "Sylhet",
    # Rangpur (8)
    "Dinajpur": "Rangpur", "Gaibandha": "Rangpur", "Kurigram": "Rangpur",
    "Lalmonirhat": "Rangpur", "Nilphamari": "Rangpur", "Panchagarh": "Rangpur",
    "Rangpur": "Rangpur", "Thakurgaon": "Rangpur",
    # Mymensingh (4)
    "Jamalpur": "Mymensingh", "Mymensingh": "Mymensingh",
    "Netrakona": "Mymensingh", "Sherpur": "Mymensingh",
}

# Highly urbanised / metropolitan districts get higher population density,
# urban proportion and dengue baseline (historic urban concentration).
METRO_DISTRICTS: set[str] = {
    "Dhaka", "Narayanganj", "Gazipur", "Chittagong", "Khulna",
    "Rajshahi", "Sylhet", "Barisal", "Comilla", "Mymensingh",
}

# Bengali display names for the citizen portal (bn-BD).
DISTRICT_NAME_BN: dict[str, str] = {
    "Dhaka": "\u09a2\u09be\u0995\u09be", "Faridpur": "\u09ab\u09b0\u09bf\u09a6\u09aa\u09c1\u09b0",
    "Gazipur": "\u0997\u09be\u099c\u09c0\u09aa\u09c1\u09b0", "Gopalganj": "\u0997\u09cb\u09aa\u09be\u09b2\u0997\u099e\u09cd\u099c",
    "Kishoreganj": "\u0995\u09bf\u09b6\u09cb\u09b0\u0997\u099e\u09cd\u099c", "Madaripur": "\u09ae\u09be\u09a6\u09be\u09b0\u09c0\u09aa\u09c1\u09b0",
    "Manikganj": "\u09ae\u09be\u09a8\u09bf\u0995\u0997\u099e\u09cd\u099c", "Munshiganj": "\u09ae\u09c1\u09a8\u09cd\u09b6\u09bf\u0997\u099e\u09cd\u099c",
    "Narayanganj": "\u09a8\u09be\u09b0\u09be\u09af\u09bc\u09a3\u0997\u099e\u09cd\u099c", "Narsingdi": "\u09a8\u09b0\u09b8\u09bf\u0982\u09a6\u09c0",
    "Rajbari": "\u09b0\u09be\u099c\u09ac\u09be\u09a1\u09bc\u09c0", "Shariatpur": "\u09b6\u09b0\u09c0\u09af\u09bc\u09a4\u09aa\u09c1\u09b0",
    "Tangail": "\u099f\u09be\u0999\u09cd\u0997\u09be\u0987\u09b2", "Bandarban": "\u09ac\u09be\u09a8\u09cd\u09a6\u09b0\u09ac\u09be\u09a8",
    "Brahamanbaria": "\u09ac\u09cd\u09b0\u09be\u09b9\u09cd\u09ae\u09a3\u09ac\u09be\u09dc\u09bf\u09af\u09bc\u09be", "Chandpur": "\u099a\u09be\u0981\u09a6\u09aa\u09c1\u09b0",
    "Chittagong": "\u099a\u099f\u09cd\u099f\u0997\u09cd\u09b0\u09be\u09ae", "Comilla": "\u0995\u09c1\u09ae\u09bf\u09b2\u09cd\u09b2\u09be",
    "Cox's Bazar": "\u0995\u0995\u09cd\u09b8\u09ac\u09be\u099c\u09be\u09b0", "Feni": "\u09ab\u09c7\u09a8\u09c0",
    "Khagrachhari": "\u0996\u09be\u0997\u09dc\u09be\u099b\u09dc\u09bf", "Lakshmipur": "\u09b2\u0995\u09cd\u09b7\u09cd\u09ae\u09c0\u09aa\u09c1\u09b0",
    "Noakhali": "\u09a8\u09cb\u09af\u09bc\u09be\u0996\u09be\u09b2\u09c0", "Rangamati": "\u09b0\u09be\u0999\u09cd\u0997\u09be\u09ae\u09be\u099f\u09bf",
    "Bogra": "\u09ac\u0997\u09c1\u09dc\u09be", "Joypurhat": "\u099c\u09af\u09bc\u09aa\u09c1\u09b0\u09b9\u09be\u099f",
    "Naogaon": "\u09a8\u09be\u0993\u0997\u09be\u0981", "Natore": "\u09a8\u09be\u099f\u09cb\u09b0",
    "Nawabganj": "\u099a\u09be\u0981\u09aa\u09be\u0987\u09a8\u09ac\u09be\u09ac\u0997\u099e\u09cd\u099c", "Pabna": "\u09aa\u09be\u09ac\u09a8\u09be",
    "Rajshahi": "\u09b0\u09be\u099c\u09b6\u09be\u09b9\u09c0", "Sirajganj": "\u09b8\u09bf\u09b0\u09be\u099c\u0997\u099e\u09cd\u099c",
    "Bagerhat": "\u09ac\u09be\u0997\u09c7\u09b0\u09b9\u09be\u099f", "Chuadanga": "\u099a\u09c1\u09af\u09bc\u09be\u09a1\u09be\u0999\u09cd\u0997\u09be",
    "Jessore": "\u09af\u09b6\u09cb\u09b0", "Jhenaidah": "\u099d\u09bf\u09a8\u09be\u0987\u09a6\u09b9",
    "Khulna": "\u0996\u09c1\u09b2\u09a8\u09be", "Kushtia": "\u0995\u09c1\u09b7\u09cd\u099f\u09bf\u09af\u09bc\u09be",
    "Magura": "\u09ae\u09be\u0997\u09c1\u09b0\u09be", "Meherpur": "\u09ae\u09c7\u09b9\u09c7\u09b0\u09aa\u09c1\u09b0",
    "Narail": "\u09a8\u09dc\u09be\u0987\u09b2", "Satkhira": "\u09b8\u09be\u09a4\u0995\u09cd\u09b7\u09c0\u09b0\u09be",
    "Barguna": "\u09ac\u09b0\u0997\u09c1\u09a8\u09be", "Barisal": "\u09ac\u09b0\u09bf\u09b6\u09be\u09b2",
    "Bhola": "\u09ad\u09cb\u09b2\u09be", "Jhalokati": "\u099d\u09be\u09b2\u0995\u09be\u09a0\u09bf",
    "Patuakhali": "\u09aa\u099f\u09c1\u09af\u09bc\u09be\u0996\u09be\u09b2\u09c0", "Pirojpur": "\u09aa\u09bf\u09b0\u09cb\u099c\u09aa\u09c1\u09b0",
    "Habiganj": "\u09b9\u09ac\u09bf\u0997\u099e\u09cd\u099c", "Maulvibazar": "\u09ae\u09cc\u09b2\u09ad\u09c0\u09ac\u09be\u099c\u09be\u09b0",
    "Sunamganj": "\u09b8\u09c1\u09a8\u09be\u09ae\u0997\u099e\u09cd\u099c", "Sylhet": "\u09b8\u09bf\u09b2\u09c7\u099f",
    "Dinajpur": "\u09a6\u09bf\u09a8\u09be\u099c\u09aa\u09c1\u09b0", "Gaibandha": "\u0997\u09be\u0987\u09ac\u09be\u09a8\u09cd\u09a7\u09be",
    "Kurigram": "\u0995\u09c1\u09dc\u09bf\u0997\u09cd\u09b0\u09be\u09ae", "Lalmonirhat": "\u09b2\u09be\u09b2\u09ae\u09a8\u09bf\u09b0\u09b9\u09be\u099f",
    "Nilphamari": "\u09a8\u09c0\u09b2\u09ab\u09be\u09ae\u09be\u09b0\u09c0", "Panchagarh": "\u09aa\u099e\u09cd\u099a\u0997\u09dc",
    "Rangpur": "\u09b0\u0982\u09aa\u09c1\u09b0", "Thakurgaon": "\u09a0\u09be\u0995\u09c1\u09b0\u0997\u09be\u0981",
    "Jamalpur": "\u099c\u09be\u09ae\u09be\u09b2\u09aa\u09c1\u09b0", "Mymensingh": "\u09ae\u09af\u09bc\u09ae\u09a8\u09b8\u09bf\u0982\u09b9",
    "Netrakona": "\u09a8\u09c7\u09a4\u09cd\u09b0\u0995\u09cb\u09a3\u09be", "Sherpur": "\u09b6\u09c7\u09b0\u09aa\u09c1\u09b0",
}
