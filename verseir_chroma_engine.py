import math
import json
import base64

class TravellingWaveFilterBank:
    """
    Simulates the cochlear response (Basilar Membrane).
    Maps acoustic frequency (Hz) to physical distance (mm) using the Greenwood function.
    """
    def __init__(self):
        self.A = 165.4
        self.a = 0.06
        self.k = 1.0
        self.length_mm = 35.0

    def frequency_to_position(self, f):
        # Inverse Greenwood function: position = (1/a) * log10( (f/A) + k )
        if f <= 0: return self.length_mm
        pos = (1.0 / self.a) * math.log10((f / self.A) + self.k)
        return max(0, min(self.length_mm, pos))

class VerseIRChromaEngine:
    """
    Mathematically determines color based on Formant (F1/F2) energy
    filtered through the Travelling-wave bank.
    """
    def __init__(self):
        self.twfb = TravellingWaveFilterBank()
        # Vowel Formants (F1, F2) approx for General American
        self.vowel_data = {
            "IY": (270, 2290), "IH": (390, 1990), "EY": (530, 1840),
            "EH": (610, 1720), "AE": (860, 1550), "AA": (730, 1090),
            "AO": (570, 840),  "OW": (460, 1100), "UH": (440, 1020),
            "UW": (300, 870),  "AH": (640, 1190), "AX": (500, 1500)
        }

    def calculate_perfect_scheme(self):
        results = {}
        for vowel, (f1, f2) in self.vowel_data.items():
            # 1. Calculate 'Linguistic Energy' via Formant Ratio
            # F2 correlates to Backness (Hue), F1 to Height (Lightness)
            pos_f2 = self.twfb.frequency_to_position(f2)
            
            # 2. Map position to Hue (360 degrees)
            # Higher F2 (Front) = Earlier wave = Cooler colors (Blue/Cyan)
            # Lower F2 (Back) = Later wave = Warmer colors (Red/Gold)
            hue = int((pos_f2 / self.twfb.length_mm) * 360) % 360
            
            # 3. Lightness based on F1 (Vocal Opening)
            # Higher F1 (Low vowels like AA) = More acoustic mass = Darker
            # Lower F1 (High vowels like IY) = Piercing/Thin = Lighter
            lightness = int(85 - (f1 / 1000.0) * 50)
            
            # 4. Saturation based on Harmonic Density (Simulated)
            saturation = 65 if vowel in ["IY", "UW", "AA"] else 45 # Pure vowels are more saturated
            
            # 5. Generate Bytecode (Hex signature of the linguistic vector)
            # Format: [F1_HEX][F2_HEX][POS_HEX]
            bytecode = f"{f1:04x}{f2:04x}{int(pos_f2*100):04x}"
            
            results[vowel] = {
                "hue": hue,
                "saturation": saturation,
                "lightness": lightness,
                "hex": f"hsl({hue}, {saturation}%, {lightness}%)",
                "bytecode": bytecode
            }
        return results

def main():
    engine = VerseIRChromaEngine()
    schemes = engine.calculate_perfect_scheme()
    
    output_file = "verseir_perfect_chroma.txt"
    with open(output_file, "w") as f:
        f.write("VERSE IR — LINGUISTIC ENERGY COLOR MANIFEST\n")
        f.write("MODEL: TRAVELLING-WAVE FILTER BANK (COCHLEAR POSITIONING)\n")
        f.write("=" * 60 + "\n\n")
        
        for vowel, data in schemes.items():
            f.write(f"PHONEME: [{vowel}]\n")
            f.write(f"  - SPECTRAL BYTECODE: 0x{data['bytecode']}\n")
            f.write(f"  - RESONANCE HUE:    {data['hue']}°\n")
            f.write(f"  - ACOUSTIC MASS:    {100 - data['lightness']}%\n")
            f.write(f"  - PERFECT COLOR:    {data['hex']}\n")
            f.write("-" * 30 + "\n")
            
    print(f"Algorithm executed. Results saved to {output_file}")

if __name__ == "__main__":
    main()
