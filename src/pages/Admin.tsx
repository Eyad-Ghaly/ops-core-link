import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, DROPDOWN_FIELD_LABELS, type AppRole } from "@/lib/constants";
import { toast } from "sonner";
import { Trash2, Plus, Check } from "lucide-react";

interface ProfileRow {
  id: string; user_id: string; email: string; full_name: string | null;
  team_code: string | null; department_code: string | null; approved: boolean;
}
interface RoleRow { user_id: string; role: AppRole; }
interface OptionRow { id: string; field_key: string; value: string; label: string; active: boolean; }

export default function Admin() {
  return (
    <AppLayout title="لوحة المدير">
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">المستخدمون والصلاحيات</TabsTrigger>
          <TabsTrigger value="dropdowns">القوائم المنسدلة</TabsTrigger>
          <TabsTrigger value="restrictions">قيود لكل مستخدم</TabsTrigger>
          <TabsTrigger value="audit">سجل التعديلات</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="dropdowns"><DropdownsTab /></TabsContent>
        <TabsContent value="restrictions"><RestrictionsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function UsersTab() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, AppRole[]>>({});

  const load = async () => {
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((ps ?? []) as ProfileRow[]);
    const m: Record<string, AppRole[]> = {};
    ((rs ?? []) as RoleRow[]).forEach((r) => { (m[r.user_id] ??= []).push(r.role); });
    setRolesMap(m);
  };
  useEffect(() => { load(); }, []);

  const toggleApproved = async (p: ProfileRow) => {
    await supabase.from("profiles").update({ approved: !p.approved }).eq("id", p.id);
    toast.success("تم التحديث");
    load();
  };

  const updateField = async (p: ProfileRow, field: "team_code" | "department_code", value: string) => {
    const patch = field === "team_code" ? { team_code: value } : { department_code: value };
    await supabase.from("profiles").update(patch).eq("id", p.id);
    load();
  };

  const toggleRole = async (uid: string, role: AppRole, has: boolean) => {
    if (has) await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    else await supabase.from("user_roles").insert({ user_id: uid, role });
    load();
  };

  return (
    <Card className="card-elevated p-4 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>البريد</TableHead><TableHead>الاسم</TableHead>
          <TableHead>كود الفريق</TableHead><TableHead>كود الإدارة</TableHead>
          <TableHead>معتمد</TableHead><TableHead>الأدوار</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.email}</TableCell>
              <TableCell>{p.full_name ?? "—"}</TableCell>
              <TableCell><Input className="w-28" defaultValue={p.team_code ?? ""} onBlur={(e) => updateField(p, "team_code", e.target.value)} dir="ltr" placeholder="SN" /></TableCell>
              <TableCell><Input className="w-28" defaultValue={p.department_code ?? ""} onBlur={(e) => updateField(p, "department_code", e.target.value)} dir="ltr" placeholder="D06" /></TableCell>
              <TableCell><Switch checked={p.approved} onCheckedChange={() => toggleApproved(p)} /></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ROLES) as AppRole[]).map((r) => {
                    const has = (rolesMap[p.user_id] ?? []).includes(r);
                    return (
                      <button key={r} onClick={() => toggleRole(p.user_id, r, has)}
                        className={`text-xs px-2 py-1 rounded-md border transition ${has ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                        {ROLES[r]}
                      </button>
                    );
                  })}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function DropdownsTab() {
  const [field, setField] = useState("project_code");
  const [opts, setOpts] = useState<OptionRow[]>([]);
  const [val, setVal] = useState(""); const [lbl, setLbl] = useState("");

  const load = async () => {
    const { data } = await supabase.from("dropdown_options").select("*").eq("field_key", field).order("label");
    setOpts((data ?? []) as OptionRow[]);
  };
  useEffect(() => { load(); }, [field]);

  const add = async () => {
    if (!val || !lbl) return;
    const { error } = await supabase.from("dropdown_options").insert({ field_key: field, value: val, label: lbl });
    if (error) toast.error(error.message); else { setVal(""); setLbl(""); load(); }
  };
  const del = async (id: string) => { await supabase.from("dropdown_options").delete().eq("id", id); load(); };
  const toggle = async (o: OptionRow) => { await supabase.from("dropdown_options").update({ active: !o.active }).eq("id", o.id); load(); };

  return (
    <Card className="card-elevated p-4 space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5"><Label>الحقل</Label>
          <Select value={field} onValueChange={setField}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DROPDOWN_FIELD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>القيمة (Value)</Label><Input value={val} onChange={(e) => setVal(e.target.value)} dir="ltr" /></div>
        <div className="space-y-1.5"><Label>الاسم المعروض</Label><Input value={lbl} onChange={(e) => setLbl(e.target.value)} /></div>
        <Button onClick={add}><Plus className="w-4 h-4 ms-2" />إضافة</Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>القيمة</TableHead><TableHead>الاسم</TableHead><TableHead>نشط</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {opts.map((o) => (
            <TableRow key={o.id}>
              <TableCell><code>{o.value}</code></TableCell>
              <TableCell>{o.label}</TableCell>
              <TableCell><Switch checked={o.active} onCheckedChange={() => toggle(o)} /></TableCell>
              <TableCell><Button size="icon" variant="ghost" onClick={() => del(o.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RestrictionsTab() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [allOptions, setAllOptions] = useState<OptionRow[]>([]);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("profiles").select("*").order("email").then(({ data }) => setProfiles((data ?? []) as ProfileRow[]));
    supabase.from("dropdown_options").select("*").eq("active", true).order("field_key").then(({ data }) => setAllOptions((data ?? []) as OptionRow[]));
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    supabase.from("user_dropdown_options").select("option_id").eq("user_id", selectedUser).then(({ data }) => {
      setAllowed(new Set((data ?? []).map((r: any) => r.option_id)));
    });
  }, [selectedUser]);

  const toggle = async (optId: string) => {
    if (!selectedUser) return;
    if (allowed.has(optId)) {
      await supabase.from("user_dropdown_options").delete().eq("user_id", selectedUser).eq("option_id", optId);
      setAllowed((s) => { const n = new Set(s); n.delete(optId); return n; });
    } else {
      await supabase.from("user_dropdown_options").insert({ user_id: selectedUser, option_id: optId });
      setAllowed((s) => new Set(s).add(optId));
    }
  };

  const grouped: Record<string, OptionRow[]> = {};
  allOptions.forEach((o) => { (grouped[o.field_key] ??= []).push(o); });

  return (
    <Card className="card-elevated p-4 space-y-4">
      <div className="space-y-1.5 max-w-md">
        <Label>اختر المستخدم</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.email}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {selectedUser && (
        <>
          <p className="text-sm text-muted-foreground">حدد الخيارات المسموح بها لهذا المستخدم. إذا لم تحدد أي خيار في حقل ما، سيرى جميع الخيارات النشطة.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(grouped).map(([field, options]) => (
              <Card key={field} className="p-3">
                <div className="font-bold text-sm mb-2">{DROPDOWN_FIELD_LABELS[field] ?? field}</div>
                <div className="space-y-1.5">
                  {options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={allowed.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(200).then(({ data }) => setLogs(data ?? []));
  }, []);
  return (
    <Card className="card-elevated p-4 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>التاريخ</TableHead><TableHead>الجدول</TableHead><TableHead>السجل</TableHead>
          <TableHead>العملية</TableHead><TableHead>المستخدم</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-xs">{new Date(l.changed_at).toLocaleString("ar-EG")}</TableCell>
              <TableCell className="font-mono text-xs">{l.table_name}</TableCell>
              <TableCell className="font-mono text-xs">{l.record_id?.slice(0, 8)}…</TableCell>
              <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted">{l.action}</span></TableCell>
              <TableCell className="font-mono text-xs">{l.changed_by?.slice(0, 8) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
