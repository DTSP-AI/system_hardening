import { MyTasks } from "@/components/dashboard/my-tasks";

export default function PrioritiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Priorities</h1>
      <MyTasks />
    </div>
  );
}
