import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Utensils, Target, Flame, FlaskConical } from "lucide-react";

export default function Perform() {
  const [, navigate] = useLocation();

  const performCards = [
    {
      title: "Nutrition",
      description: "Fuel your body with personalized nutrition, hydration tracking, and macro guidance.",
      icon: Utensils,
      colour: "text-orange-500",
      path: "/nutrition",
      testId: "card-perform-nutrition"
    },
    {
      title: "Goals",
      description: "Set and track long-term objectives aligned with your performance and health.",
      icon: Target,
      colour: "text-blue-500",
      path: "/goals",
      testId: "card-perform-goals"
    },
    {
      title: "Habits",
      description: "Build daily habits that support your goals and drive consistent progress.",
      icon: Flame,
      colour: "text-red-500",
      path: "/habits",
      testId: "card-perform-habits"
    },
    {
      title: "The Lab",
      description: "Explore curated learning paths, guides, and educational content to level up your knowledge.",
      icon: FlaskConical,
      colour: "text-purple-500",
      path: "/education-lab",
      testId: "card-perform-the-lab"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-4 pb-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-[28px] font-bold text-[#0cc9a9] tracking-tight mb-4">Perform</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card 
                  key={card.title} 
                  className="bg-card hover:shadow-lg transition-shadow cursor-pointer"
                  data-testid={card.testId}
                  onClick={() => navigate(card.path)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`h-6 w-6 ${card.colour}`} />
                      <CardTitle className="text-xl">{card.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-6">
                      {card.description}
                    </p>
                    <Button 
                      className="w-full btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(card.path);
                      }}
                      data-testid={`button-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      Explore {card.title}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
