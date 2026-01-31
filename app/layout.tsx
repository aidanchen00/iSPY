import HeaderAuth from "@/components/header-auth";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import HomeLink from "@/components/home-link";
import { HeaderNav } from "@/components/header-nav";
import { GeminiFooter } from "@/components/gemini-footer";
import "./globals.css";
import "nprogress/nprogress.css";
import { NavigationEvents } from "@/components/navigation-events";
import NProgress from "nprogress";
import StackClientWrapper from "@/components/stack-client-wrapper";

// Configure NProgress to complete instantly
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 1,
  minimum: 0.99,
  easing: 'ease',
  speed: 1
});

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

export const metadata = {
	metadataBase: new URL(defaultUrl),
	title: "KIMSTORE",
	description: "Real-time workplace safety monitoring and analysis",
};

const geistSans = Geist({
	display: "swap",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
		return (
			<html lang="en" className={geistSans.className} suppressHydrationWarning>
				<body className="bg-slate-950 text-foreground" suppressHydrationWarning>
					<StackClientWrapper>
						<NavigationEvents />
						<ThemeProvider
							attribute="class"
							defaultTheme="dark"
							enableSystem
							disableTransitionOnChange
						>
							{children}
						</ThemeProvider>
					</StackClientWrapper>
				</body>
			</html>
		);
}
