import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Mail, 
  HelpCircle, 
  Bug, 
  Lightbulb,
  FileText,
  Shield,
  ChevronRight,
  Loader2,
  ExternalLink
} from "lucide-react";

const faqs = [
  {
    question: "How do I track my workouts?",
    answer: "Navigate to the Movement section from the bottom navigation. You can view your scheduled workouts, start a workout, and log your sets and reps as you go."
  },
  {
    question: "How do I log my meals?",
    answer: "Go to the Perform section and tap on Nutrition. You can add foods to your meals, track calories and macros, and view your nutrition history."
  },
  {
    question: "How do I use the Body Map?",
    answer: "The Body Map is in the Recovery section. Tap on any body part to log pain or discomfort, rate its severity, and get personalized recovery recommendations."
  },
  {
    question: "How do I change my goals?",
    answer: "Go to Profile > Goals & Preferences. You can update your calorie targets, workout frequency, and other personal goals."
  },
  {
    question: "How do I track my water intake?",
    answer: "Hydration tracking is available in the Perform section on the home dashboard. Tap the water droplet to log your water intake throughout the day."
  },
  {
    question: "Can I export my data?",
    answer: "Yes! Go to Profile > Privacy & Security > Export My Data. You can download a complete copy of all your data as a JSON file."
  },
];

const aiDataFaqs = [
  {
    question: "Where are my AI Coach conversations stored?",
    answer: "Your AI Coach conversations are stored securely in our encrypted database, linked to your account. They are never shared with third parties. You can view, load, or delete past conversations at any time using the history icon in the AI Coach panel."
  },
  {
    question: "What data does the AI Coach use to respond?",
    answer: "The AI Coach uses your health profile, recent workouts, body map assessments, check-in data, nutrition logs, and sleep/stress patterns to personalise its responses. It only accesses data you've entered into the platform — nothing external."
  },
  {
    question: "Can my employer see my AI Coach conversations?",
    answer: "No. Your AI Coach conversations are completely private and visible only to you. Your employer and team administrators cannot access any individual conversations, messages, or AI interactions."
  },
  {
    question: "What does my employer see in company reports?",
    answer: "Company reports only show anonymous, aggregate data — averages, trends, and participation rates across the team. Individual responses are never identifiable. Reports require a minimum of 5 non-admin users and musculoskeletal pain data is only surfaced at severity level 4 or above."
  },
  {
    question: "Is my AI feedback (thumbs up/down) anonymous?",
    answer: "Your feedback ratings help us improve AI response quality. While feedback is linked to your account for context, it is only used internally by system administrators to refine the AI. It is never shared with your employer or any third party."
  },
  {
    question: "Can I delete my AI conversation history?",
    answer: "Yes. You can delete individual conversations from the AI Coach history panel at any time. If you delete your account (Profile > Privacy & Security), all your data — including every AI conversation — is permanently removed."
  },
  {
    question: "Is my data used to train AI models?",
    answer: "No. Your personal data and conversations are not used to train any external AI models. AI responses are generated in real-time using your data as context, but nothing is fed back into model training."
  },
  {
    question: "How is my health data protected?",
    answer: "All data is transmitted over encrypted connections (HTTPS) and stored in a secure, encrypted database. Access is controlled through authenticated sessions with HTTP-only cookies. Your data is never sold or shared with third parties."
  },
];

export default function HelpSupport() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [showReportBug, setShowReportBug] = useState(false);
  const [showRequestFeature, setShowRequestFeature] = useState(false);
  
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSteps, setBugSteps] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");

  const contactSupportMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      return await apiRequest("POST", "/api/support/contact", data);
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "We'll get back to you soon!" });
      setShowContactSupport(false);
      setContactSubject("");
      setContactMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const reportBugMutation = useMutation({
    mutationFn: async (data: { description: string; steps: string }) => {
      return await apiRequest("POST", "/api/support/bug-report", data);
    },
    onSuccess: () => {
      toast({ title: "Bug report submitted", description: "Thank you for helping us improve!" });
      setShowReportBug(false);
      setBugDescription("");
      setBugSteps("");
    },
    onError: () => {
      toast({ title: "Failed to submit bug report", variant: "destructive" });
    },
  });

  const requestFeatureMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      return await apiRequest("POST", "/api/support/feature-request", data);
    },
    onSuccess: () => {
      toast({ title: "Feature request submitted", description: "We appreciate your feedback!" });
      setShowRequestFeature(false);
      setFeatureTitle("");
      setFeatureDescription("");
    },
    onError: () => {
      toast({ title: "Failed to submit feature request", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    {
      icon: Mail,
      label: "Contact Support",
      description: "Get help from our team",
      onClick: () => setShowContactSupport(true),
      testId: "btn-contact-support",
    },
    {
      icon: Bug,
      label: "Report a Bug",
      description: "Let us know about issues",
      onClick: () => setShowReportBug(true),
      testId: "btn-report-bug",
    },
    {
      icon: Lightbulb,
      label: "Request a Feature",
      description: "Suggest new functionality",
      onClick: () => setShowRequestFeature(true),
      testId: "btn-request-feature",
    },
  ];

  const legalLinks = [
    {
      icon: FileText,
      label: "Terms of Service",
      href: "#",
      testId: "link-terms",
      comingSoon: true,
    },
    {
      icon: Shield,
      label: "Privacy Policy",
      href: "#",
      testId: "link-privacy",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Help & Support" onBack={() => navigate("/profile")} />

      <div className="p-4 pt-14 space-y-6">
        {/* Contact Options */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Get Help</h3>
          <Card className="divide-y divide-border">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                data-testid={item.testId}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </Card>
        </div>

        {/* AI & Data Privacy FAQs */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
            <Shield className="inline h-4 w-4 mr-1" />
            AI & Data Privacy
          </h3>
          <Card className="p-2">
            <Accordion type="single" collapsible className="w-full">
              {aiDataFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`ai-faq-${index}`}>
                  <AccordionTrigger className="text-left text-sm px-2">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground px-2">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>

        {/* General FAQs */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
            <HelpCircle className="inline h-4 w-4 mr-1" />
            Frequently Asked Questions
          </h3>
          <Card className="p-2">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-sm px-2">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground px-2">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>

        {/* Legal Links */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Legal</h3>
          <Card className="divide-y divide-border">
            {legalLinks.map((link) => (
              <div
                key={link.label}
                className="w-full px-4 py-4 flex items-center gap-4 opacity-50"
                data-testid={link.testId}
              >
                <div className="p-2 rounded-lg bg-muted">
                  <link.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Contact Support Dialog */}
      <Dialog open={showContactSupport} onOpenChange={setShowContactSupport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Send us a message and we'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="What do you need help with?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactSupport(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => contactSupportMutation.mutate({ subject: contactSubject, message: contactMessage })}
              disabled={contactSupportMutation.isPending || !contactSubject || !contactMessage}
            >
              {contactSupportMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Bug Dialog */}
      <Dialog open={showReportBug} onOpenChange={setShowReportBug}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription>
              Help us improve by reporting issues you've encountered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bug-description">What went wrong?</Label>
              <Textarea
                id="bug-description"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-steps">Steps to reproduce (optional)</Label>
              <Textarea
                id="bug-steps"
                value={bugSteps}
                onChange={(e) => setBugSteps(e.target.value)}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportBug(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => reportBugMutation.mutate({ description: bugDescription, steps: bugSteps })}
              disabled={reportBugMutation.isPending || !bugDescription}
            >
              {reportBugMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Feature Dialog */}
      <Dialog open={showRequestFeature} onOpenChange={setShowRequestFeature}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Feature</DialogTitle>
            <DialogDescription>
              Have an idea to make the app better? We'd love to hear it!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feature-title">Feature Title</Label>
              <Input
                id="feature-title"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
                placeholder="e.g., Dark mode, Apple Watch sync..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feature-description">Description</Label>
              <Textarea
                id="feature-description"
                value={featureDescription}
                onChange={(e) => setFeatureDescription(e.target.value)}
                placeholder="Explain how this feature would help you..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestFeature(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => requestFeatureMutation.mutate({ title: featureTitle, description: featureDescription })}
              disabled={requestFeatureMutation.isPending || !featureTitle || !featureDescription}
            >
              {requestFeatureMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
