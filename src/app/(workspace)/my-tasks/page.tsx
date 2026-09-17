import { currentUser } from "@/lib/current-user";
import { taskList, taskStats, teamMembers, type Filters } from "@/lib/queries";
import { catchUp } from "@/lib/scheduler";
import { ActionDialog } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { TaskList, Stats } from "@/components/task-list";
import { createTaskAction } from "@/app/actions";
export const metadata = { title: "My tasks" };
export default async function MyTasks({ searchParams }: { searchParams: Promise<Filters> }) {
  const actor = await currentUser(); const filters = await searchParams;
  const warning = await catchUp(); const now = Date.now();
  const [result, stats, people] = await Promise.all([taskList(actor, "mine", filters, now), taskStats(actor, "mine", filters, now), teamMembers(actor, true)]);
  return <>
    <div className="page-heading"><div><p className="eyebrow" style={{ margin: "0 0 8px" }}>YOUR WORK, IN FOCUS</p><h1>My tasks</h1><p>A clear view of what’s next and what’s done.</p></div><div className="heading-actions"><ActionDialog title="Create a task" description="Give the work a clear outcome and a deadline." trigger="New task" action={createTaskAction} submit="Create task"><TaskFields people={people} actor={actor} /></ActionDialog></div></div>
    {warning && <p className="notice notice-warning" role="status" style={{ marginBottom: 20 }}>{warning}</p>}
    <Stats stats={stats} /><TaskList result={result} filters={filters} people={people} base="/my-tasks" now={now} />
    <p className="field-hint" style={{ marginTop: 14 }}>Overview counts cover all matching tasks, across the date tabs. All times are IST.</p>
  </>;
}
