import { EntryForm } from "@/components/entry-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function QuickEntry() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-heading">Quick Entry</h1>
        <p className="text-muted-foreground">Log your hours quickly for any project.</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>New Time Entry</CardTitle>
          <CardDescription>Select a project and enter hours. Earnings are calculated automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryForm />
        </CardContent>
      </Card>
    </div>
  );
}
