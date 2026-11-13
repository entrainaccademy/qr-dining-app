// Single place to rebrand the guest app. Colors are exposed as CSS variables in layout.tsx.
export const brand = {
  hotelName: "Grand Stay Hotel",
  restaurantName: "Spice Route Kitchen",
  logoText: "Spice Route",
  cuisine: "North Indian · Continental",
  hours: "Daily 7:00 AM – 11:30 PM",
  deliveryEstimate: "30–40 min",
  restaurantPhone: "+91 80 4000 1234",
  currencySymbol: "₹",
  gstPercent: 5,
  colors: {
    // Emerald + ivory with a brass highlight. Change these to rebrand the whole guest app.
    background: "#F6F2E9", // ivory
    surface: "#FFFEFB",
    ink: "#14231E", // deep green-black
    muted: "#5C6862",
    line: "#DCE0D3",
    accent: "#1F5F4B", // emerald
    accentDark: "#164A3A",
    accentSoft: "#E1EDE5",
    brass: "#B08D4C", // decorative highlights (rules, rings)
    veg: "#2E7D32",
    nonVeg: "#B3261E",
  },
} as const;

export const formatPrice = (n: number) =>
  `${brand.currencySymbol}${n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const phoneHref = `tel:${brand.restaurantPhone.replace(/\s/g, "")}`;
