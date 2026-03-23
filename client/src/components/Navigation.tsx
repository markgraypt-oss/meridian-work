import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { Search, Bell, Menu } from "lucide-react";
import logoImage from "@assets/tuil_1750012006547.png";

export default function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", active: location === "/" },
    { href: "/training", label: "Training", active: location === "/training" || location.startsWith("/program") },
    { href: "/library", label: "Library", active: location === "/library" },
    { href: "/nutrition", label: "Nutrition", active: location === "/nutrition" },
    { href: "/calendar", label: "Calendar", active: location === "/calendar" },
    { href: "/body-map", label: "Body Map", active: location === "/body-map" },
    { href: "/admin", label: "Admin", active: location === "/admin" },
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#2c3e50' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img 
                src={logoImage} 
                alt="Meridian Work" 
                className="h-12 w-auto mr-3"
              />
              <span className="font-bold text-xl text-white">Meridian Work</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.active
                      ? "text-blue-300 bg-blue-900/20"
                      : "text-gray-200 hover:text-white hover:bg-gray-700/20"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/search">
              <Button variant="ghost" size="sm" className="p-2 text-gray-200 hover:text-white">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            
            <Button variant="ghost" size="sm" className="p-2 relative text-gray-200 hover:text-white">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                2
              </span>
            </Button>
            
            <div className="flex items-center space-x-3">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium text-sm">
                    {user?.firstName?.charAt(0) || "U"}
                  </span>
                </div>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="text-gray-200 border-gray-400 hover:text-white hover:border-white"
              >
                Sign Out
              </Button>
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 text-gray-200 hover:text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col h-full">
                  <div className="flex items-center mb-8">
                    <img 
                      src={logoImage} 
                      alt="Meridian Work" 
                      className="h-8 w-auto mr-2"
                    />
                    <span className="font-bold text-lg">Meridian Work</span>
                  </div>
                  
                  <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          item.active
                            ? "text-primary bg-primary/10"
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                    
                    <Link 
                      href="/search"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5"
                    >
                      Search
                    </Link>
                  </nav>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center px-3 py-2 mb-4">
                      {user?.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt="Profile"
                          className="h-8 w-8 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                          <span className="text-primary font-medium text-sm">
                            {user?.firstName?.charAt(0) || "U"}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handleLogout}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
