import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  REGIONS, MISSION_TYPES, TRANSPORT_MODES, DATA_SOURCES,
  VOLUNTEER_CHANGE_REASONS, VOLUNTEER_NOTE_TYPES, POINTS_OPTIONS, STATUS_LABELS,
} from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Save, Send, Plus, Trash2, AlertCircle } from "lucide-react";

export default function MissionDetail() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [mission, setMission] = useState<any | null>(null);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOps = hasRole("operations_room") || hasRole("operations_supervisor") || hasRole("admin");
  const isJoker = hasRole("joker") || hasRole("admin");
  const isSup = hasRole("operations_supervisor") || hasRole("admin");
  const isYouth = hasRole("youth_room") || hasRole("admin");
  const isData = hasRole("data_manager") || hasRole("admin");
  const canEdit = isOps || isJoker || isSup || isYouth || isData;

  // Hidden in operations room (sensitive). Visible to joker/supervisor/data/admin.
  const opsHide = !(isJoker || isSup || isData || hasRole("admin"));

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: m }, { data: v }, { data: d }, { data: r }, { data: n }] = await Promise.all([
      supabase.from("missions").select("*").eq("id", id).maybeSingle(),
      supabase.from("mission_volunteers").select("*").eq("mission_id", id).order("created_at"),
      supabase.from("mission_drivers").select("*").eq("mission_id", id),
      supabase.from("mission_routes").select("*").eq("mission_id", id).order("position"),
      supabase.from("volunteer_notes").select("*").eq("mission_id", id),
    ]);
    setMission(m); setVolunteers(v ?? []); setDrivers(d ?? []); setRoutes(r ?? []); setNotes(n ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <AppLayout title="..."><Card className="p-8">جاري التحميل...</Card></AppLayout>;
  if (!mission) return <AppLayout title="غير موجود"><Card className="p-8">المهمة غير موجودة</Card></AppLayout>;

  const updateMission = (patch: Partial<typeof mission>) => setMission({ ...mission, ...patch });

  const save = async (extraPatch: any = {}) => {
    setBusy(true);
    const patch = { ...extraPatch };
    Object.keys(mission).forEach((k) => {
      if (!["id", "mission_code", "created_at", "updated_at", "created_by", "team_code"].includes(k)) {
        patch[k] = mission[k];
      }
    });
    const { error } = await supabase.from("missions").update(patch).eq("id", mission.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("تم الحفظ");
    load();
  };

  const transition = async (newStatus: string, label: string) => {
    const stamp = new Date().toISOString();
    const stampField: Record<string, string> = {
      entered: "ops_entered_at", reviewed: "reviewed_at",
      sent_to_youth: "sent_to_youth_at", sent_to_supervisor: "sent_to_supervisor_at",
      monitored: "monitored_at",
    };
    await save({ status: newStatus, [stampField[newStatus] ?? "updated_at"]: stamp });
    toast.success(label);
  };

  // Volunteer ops
  const addVol = async () => {
    await supabase.from("mission_volunteers").insert({ mission_id: mission.id, full_name: "متطوع جديد", added_in_ops: true });
    load();
  };
  const updateVol = async (vid: string, patch: any) => {
    await supabase.from("mission_volunteers").update(patch).eq("id", vid);
    load();
  };
  const removeVol = async (vid: string) => {
    await supabase.from("mission_volunteers").update({ removed: true }).eq("id", vid);
    load();
  };

  // Drivers
  const addDriver = async () => {
    await supabase.from("mission_drivers").insert({ mission_id: mission.id, driver_name: "" });
    load();
  };
  const updateDriver = async (did: string, patch: any) => { await supabase.from("mission_drivers").update(patch).eq("id", did); load(); };
  const delDriver = async (did: string) => { await supabase.from("mission_drivers").delete().eq("id", did); load(); };

  // Routes
  const addRoute = async () => {
    await supabase.from("mission_routes").insert({ mission_id: mission.id, place: "", position: routes.length });
    load();
  };
  const updateRoute = async (rid: string, patch: any) => { await supabase.from("mission_routes").update(patch).eq("id", rid); load(); };
  const delRoute = async (rid: string) => { await supabase.from("mission_routes").delete().eq("id", rid); load(); };

  return (
    <AppLayout title={`المهمة ${mission.mission_code}`}>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <Card className="card-elevated p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <code className="text-sm font-mono bg-primary-soft text-primary px-2.5 py-1 rounded font-bold">{mission.mission_code}</code>
                <StatusBadge status={mission.status} />
              </div>
              <h2 className="text-xl font-bold">{mission.mission_name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{mission.activity_date} • {mission.governorate ?? "—"} • {mission.execution_place ?? "—"}</p>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> كود المهمة لا يمكن تعديله
            </div>
          </div>
        </Card>

        {/* Visible mission data */}
        <Card className="card-elevated p-5 space-y-4">
          <h3 className="font-bold">بيانات المهمة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <Info label="اسم المهمة" value={mission.mission_name} />
            <Info label="المحافظة" value={mission.governorate} />
            <Info label="مكان التنفيذ" value={mission.execution_place} />
            <Info label="التاريخ" value={mission.activity_date} />
            <Info label="مسؤول المتابعة" value={mission.follow_up_responsible} />
            <Info label="تليفون المتابعة" value={mission.follow_up_phone} />
            {!opsHide && (
              <>
                <Info label="كود الإدارة" value={mission.admin_code} />
                <Info label="كود المشروع" value={mission.project_code} />
                <Info label="تصنيف النشاط" value={mission.activity_classification} />
                <Info label="نوع النشاط" value={mission.activity_type} />
                <Info label="تفاصيل النشاط" value={mission.activity_details} />
                <Info label="إحداثيات" value={mission.latitude ? `${mission.latitude}, ${mission.longitude}` : null} />
              </>
            )}
          </div>
        </Card>

        {/* Operations Room editing */}
        {(isOps || isJoker || isSup) && (
          <Card className="card-elevated p-5 space-y-4">
            <h3 className="font-bold">إعداد التنفيذ (غرفة العمليات)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>الإقليم</Label>
                <Select value={mission.region ?? ""} onValueChange={(v) => updateMission({ region: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{Object.entries(REGIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>نوع المهمة</Label>
                <Select value={mission.mission_type ?? ""} onValueChange={(v) => updateMission({ mission_type: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{Object.entries(MISSION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {mission.mission_type === "external" && (
                <div className="space-y-1.5"><Label>المواصلات</Label>
                  <Select value={mission.transport_mode ?? ""} onValueChange={(v) => updateMission({ transport_mode: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{Object.entries(TRANSPORT_MODES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {mission.mission_type === "external" && mission.transport_mode === "driver" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>السائقون والعربيات</Label>
                  <Button size="sm" variant="outline" onClick={addDriver}><Plus className="w-4 h-4 ms-1" />إضافة سائق</Button></div>
                {drivers.map((d) => (
                  <div key={d.id} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-6" placeholder="اسم السائق" defaultValue={d.driver_name} onBlur={(e) => updateDriver(d.id, { driver_name: e.target.value })} />
                    <Input className="col-span-5" placeholder="رقم العربية" defaultValue={d.vehicle_number ?? ""} onBlur={(e) => updateDriver(d.id, { vehicle_number: e.target.value })} dir="ltr" />
                    <Button size="icon" variant="ghost" onClick={() => delDriver(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}

            {mission.mission_type === "external" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>خط السير</Label>
                  <Button size="sm" variant="outline" onClick={addRoute}><Plus className="w-4 h-4 ms-1" />نقطة مرور</Button></div>
                {routes.map((r) => (
                  <div key={r.id} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-7" placeholder="المكان" defaultValue={r.place} onBlur={(e) => updateRoute(r.id, { place: e.target.value })} />
                    <Input className="col-span-4" type="datetime-local" defaultValue={r.route_time?.slice(0, 16) ?? ""} onBlur={(e) => updateRoute(r.id, { route_time: e.target.value || null })} />
                    <Button size="icon" variant="ghost" onClick={() => delRoute(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}

            {/* Ops box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="space-y-1.5"><Label>المشرف</Label><Input value={mission.supervisor ?? ""} onChange={(e) => updateMission({ supervisor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>القائم بتعبئة الاستمارة</Label><Input value={mission.filler_volunteer ?? ""} onChange={(e) => updateMission({ filler_volunteer: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>القائم بمراجعة الاستمارة</Label><Input value={mission.reviewer_volunteer ?? ""} onChange={(e) => updateMission({ reviewer_volunteer: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>المشرف المراجع</Label><Input value={mission.reviewing_supervisor ?? ""} onChange={(e) => updateMission({ reviewing_supervisor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>المتطوع المستكمل للاستمارة</Label><Input value={mission.completing_volunteer ?? ""} onChange={(e) => updateMission({ completing_volunteer: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>الجوكر</Label><Input value={mission.joker_name ?? ""} onChange={(e) => updateMission({ joker_name: e.target.value })} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label>مصدر البيانات</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {Object.entries(DATA_SOURCES).map(([k, v]) => {
                    const sources: string[] = mission.data_sources ?? [];
                    const has = sources.includes(k);
                    return (
                      <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={has} onCheckedChange={() => updateMission({ data_sources: has ? sources.filter((x) => x !== k) : [...sources, k] })} />
                        {v}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Volunteers */}
        <Card className="card-elevated p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">المتطوعون</h3>
            {canEdit && <Button size="sm" variant="outline" onClick={addVol}><Plus className="w-4 h-4 ms-1" />إضافة متطوع</Button>}
          </div>
          {volunteers.filter((v) => !v.removed).length === 0 && <p className="text-sm text-muted-foreground">لا يوجد متطوعون</p>}
          {volunteers.filter((v) => !v.removed).map((v) => (
            <Card key={v.id} className="p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <Input className="md:col-span-3" defaultValue={v.full_name} onBlur={(e) => updateVol(v.id, { full_name: e.target.value })} placeholder="الاسم" />
                <Input className="md:col-span-2" defaultValue={v.membership_number ?? ""} onBlur={(e) => updateVol(v.id, { membership_number: e.target.value })} placeholder="رقم العضوية" dir="ltr" />
                <Input className="md:col-span-2" defaultValue={v.branch ?? ""} onBlur={(e) => updateVol(v.id, { branch: e.target.value })} placeholder="الفرع" />
                <Input className="md:col-span-2" type="datetime-local" defaultValue={v.arrival_time?.slice(0, 16) ?? ""} onBlur={(e) => updateVol(v.id, { arrival_time: e.target.value || null })} />
                <Input className="md:col-span-2" type="datetime-local" defaultValue={v.departure_time?.slice(0, 16) ?? ""} onBlur={(e) => updateVol(v.id, { departure_time: e.target.value || null })} />
                <Button size="icon" variant="ghost" onClick={() => removeVol(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                <div className="text-muted-foreground">الساعات: <strong className="text-foreground">{v.hours ? Number(v.hours).toFixed(2) : "—"}</strong></div>
                {isYouth && (
                  <div className="space-y-1"><Label className="text-xs">النقاط</Label>
                    <Select value={String(v.points ?? "")} onValueChange={(val) => updateVol(v.id, { points: Number(val) })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{POINTS_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1"><Label className="text-xs">سبب التغيير</Label>
                  <Select value={v.change_reason ?? ""} onValueChange={(val) => updateVol(v.id, { change_reason: val })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{Object.entries(VOLUNTEER_CHANGE_REASONS).map(([k, vv]) => <SelectItem key={k} value={k}>{vv}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {isYouth && (
                  <div className="space-y-1"><Label className="text-xs">ملاحظة</Label>
                    <Select value="" onValueChange={async (val) => {
                      await supabase.from("volunteer_notes").insert({ mission_id: mission.id, volunteer_id: v.id, note_type: val as any });
                      load(); toast.success("تمت إضافة الملاحظة");
                    }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="إضافة ملاحظة" /></SelectTrigger>
                      <SelectContent>{Object.entries(VOLUNTEER_NOTE_TYPES).map(([k, vv]) => <SelectItem key={k} value={k}>{vv}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {notes.filter((n) => n.volunteer_id === v.id).length > 0 && (
                <div className="text-xs space-y-0.5 pt-1">
                  {notes.filter((n) => n.volunteer_id === v.id).map((n) => (
                    <div key={n.id} className="text-warning">• {VOLUNTEER_NOTE_TYPES[n.note_type as keyof typeof VOLUNTEER_NOTE_TYPES] ?? n.note_type}</div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </Card>

        {/* Youth box */}
        {isYouth && (
          <Card className="card-elevated p-5 space-y-4">
            <h3 className="font-bold">صندوق غرفة الشباب</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>اسم الراصد</Label><Input value={mission.monitor_name ?? ""} onChange={(e) => updateMission({ monitor_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>اسم المراجع</Label><Input value={mission.youth_reviewer ?? ""} onChange={(e) => updateMission({ youth_reviewer: e.target.value })} /></div>
              <div className="space-y-1.5 md:col-span-2"><Label>ملاحظات</Label><Textarea rows={3} value={mission.youth_notes ?? ""} onChange={(e) => updateMission({ youth_notes: e.target.value })} /></div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <Card className="card-elevated p-5">
          <div className="flex flex-wrap gap-2 justify-end">
            {canEdit && <Button variant="outline" onClick={() => save()} disabled={busy}><Save className="w-4 h-4 ms-2" />حفظ</Button>}
            {isOps && <Button onClick={() => transition("entered", "تم الإدخال")} disabled={busy}><Send className="w-4 h-4 ms-2" />إرسال للجوكر</Button>}
            {isJoker && (<>
              <Button variant="secondary" onClick={() => transition("reviewed", "تمت المراجعة")} disabled={busy}>تمت المراجعة</Button>
              <Button onClick={() => transition("sent_to_supervisor", "تم الإرسال للمشرف")} disabled={busy}><Send className="w-4 h-4 ms-2" />إرسال للمشرف</Button>
              <Button onClick={() => transition("sent_to_youth", "تم الإرسال للشباب")} disabled={busy}><Send className="w-4 h-4 ms-2" />إرسال للشباب</Button>
            </>)}
            {isSup && (<>
              <Button variant="secondary" onClick={() => transition("reviewed", "تمت المراجعة")} disabled={busy}>تمت المراجعة</Button>
              <Button onClick={() => transition("sent_to_youth", "تم الإرسال للشباب")} disabled={busy}><Send className="w-4 h-4 ms-2" />إرسال للشباب</Button>
            </>)}
            {isYouth && <Button onClick={() => transition("monitored", "تم الرصد")} disabled={busy}><Send className="w-4 h-4 ms-2" />إرسال لغرفة العمليات (تم الرصد)</Button>}
          </div>
        </Card>

        {/* Workflow timeline */}
        <Card className="card-elevated p-5">
          <h3 className="font-bold mb-3">سير العمل</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>الإنشاء: {new Date(mission.created_at).toLocaleString("ar-EG")}</div>
            {mission.submitted_at && <div>الإرسال: {new Date(mission.submitted_at).toLocaleString("ar-EG")}</div>}
            {mission.ops_entered_at && <div>الإدخال: {new Date(mission.ops_entered_at).toLocaleString("ar-EG")}</div>}
            {mission.reviewed_at && <div>المراجعة: {new Date(mission.reviewed_at).toLocaleString("ar-EG")}</div>}
            {mission.sent_to_youth_at && <div>إرسال للشباب: {new Date(mission.sent_to_youth_at).toLocaleString("ar-EG")}</div>}
            {mission.sent_to_supervisor_at && <div>إرسال للمشرف: {new Date(mission.sent_to_supervisor_at).toLocaleString("ar-EG")}</div>}
            {mission.monitored_at && <div>الرصد: {new Date(mission.monitored_at).toLocaleString("ar-EG")}</div>}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
