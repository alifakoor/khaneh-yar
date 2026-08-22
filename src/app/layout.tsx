import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata={title:"خانه‌یار مشهد",description:"دستیار شخصی مقایسه و رتبه‌بندی خانه"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body className="font-sans antialiased">{children}</body></html>}
