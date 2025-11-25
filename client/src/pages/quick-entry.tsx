import { EntryForm } from "@/components/entry-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function QuickEntry() {
  return (
    <div className="space-y-6 md:space-y-8 max-w-3xl mx-auto px-4 md:px-0">
      <div className="flex flex-col gap-1 md:gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-heading">Quick Entry</h1>
        <p className="text-sm md:text-base text-muted-foreground">Log your hours quickly for any project.</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl md:text-2xl">New Time Entry</CardTitle>
          <CardDescription className="text-sm md:text-base mt-1">Select a project and enter hours. Earnings are calculated automatically.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <EntryForm />
        </CardContent>
      </Card>
    </div>
  );
}
