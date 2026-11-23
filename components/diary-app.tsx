"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { checkPhoto, describePhoto } from "../lib/ai/client";
import { getAsset, syncMessages } from "../lib/diary/cloud";
import {
  activeProject, assetPath, captureTime, entryKey, localDay, photosForDay, poorAccuracyMetres, reportDate,
  reportFilename, reportsForDay, tracked, waiting,
  type LocalPhoto, type LocalReport, type Photo, type PhotoReview, type Project,
} from "../lib/diary/model";
import { createDiaryClient, type DiaryClient } from "../lib/supabase";
import { Login, Settings } from "./account";
import { Camera, type CameraCapture } from "./camera";
import { NoteEditor } from "./note-editor";
import { PdfPreview } from "./pdf-preview";
import { PhotoImage } from "./photo-image";
import { useDiary } from "./use-diary";
import { useDiarySession } from "./use-diary-session";

type Tab = "diary" | "history" | "settings";
type Stage = "list" | "camera" | "captured" | "notes" | "preview";
type ProjectFields = Pick<Project, "name" | "company_name" | "prepared_by">;

function cacheShell() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({
      assets: performance.getEntriesByType("resource").map((resource) => resource.name),
    });
  }).catch(() => {});
}

export function DiaryApp() {
  const [client, setClient] = useState<DiaryClient | null>(null);
  const [configured, setConfigured] = useState(true);
  const auth = useDiarySession(client);

  useEffect(() => {
    const next = createDiaryClient();
    setClient(next);
    setConfigured(Boolean(next));
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then(cacheShell).catch(() => {});
    }
  }, []);

  return (
    <div className="site">
      <header className="site-header"><div className="shell">Project Site Diary</div></header>
      <main className="shell diary-main">
        {!configured ? <p className="notice warning" role="alert">The Supabase connection has not been configured.</p>
          : !auth.ready ? <p className="muted" role="status">Opening your diary…</p>
          : client && auth.owner ? <Workspace key={auth.owner} client={client} owner={auth.owner} session={auth.session}
              signIn={auth.signIn} signOut={auth.signOut} />
          : <Login signIn={auth.signIn} />}
      </main>
    </div>
  );
}

function Workspace({ client, owner, session, signIn, signOut }: {
  client: DiaryClient; owner: string; session: Session | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}) {
  const { diary, save, retry, issue, syncing, localError, checkedCloud } = useDiary(owner, client, session);
  const [tab, setTab] = useState<Tab>("diary");
  const [stage, setStage] = useState<Stage>("list");
  const [day, setDay] = useState(localDay);
  const [currentId, setCurrentId] = useState("");
  const [retakeId, setRetakeId] = useState("");
  const [reconnect, setReconnect] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [newReport, setNewReport] = useState(false);
  const [startingReport, setStartingReport] = useState(false);

  useEffect(() => {
    void import("../lib/pdf/report").then(cacheShell).catch(() => {});
  }, []);

  const project = diary ? activeProject(diary) : null;
  const photos = diary && project ? photosForDay(diary, project.id, day) : [];
  const reports = diary && project ? reportsForDay(diary, project.id, day) : [];
  const active = photos.find((photo) => photo.row.id === currentId);
  const activeNumber = photos.findIndex((photo) => photo.row.id === currentId) + 1;
  const queue = diary ? waiting(diary) : 0;
  const canUseAi = Boolean(session) && issue !== "offline";
  const checking = photos.some((photo) => photo.review === "checking");
  const ready = photos.length > 0 && !checking && photos.every((photo) => photo.row.description_approved_at);
  const date = reportDate(day);

  function navigate(next: Tab) {
    setTab(next);
    setNewReport(false);
    setStage("list");
    setNotice("");
  }

  async function openDay(value: string, projectId = project?.id) {
    if (!value || !projectId) return;
    if (projectId !== project?.id) {
      await save((stored) => { stored.activeProjectId = projectId; });
    }
    setDay(value);
    navigate("diary");
  }

  function showNewReport() {
    navigate("diary");
    setNewReport(true);
  }

  async function startReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startingReport) return;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) {
      setNotice("Enter a project name.");
      return;
    }
    setStartingReport(true);
    try {
      const today = localDay();
      const createdAt = new Date().toISOString();
      const id = crypto.randomUUID();
      await save((stored) => {
        stored.projects[id] = tracked({
          id, user_id: owner, name, company_name: null, prepared_by: null, created_at: createdAt,
        });
        stored.entries[entryKey(id, today)] = tracked({
          id: crypto.randomUUID(), project_id: id, user_id: owner, report_date: today, created_at: createdAt,
        });
        stored.activeProjectId = id;
      });
      setDay(today);
      setFile(null);
      navigate("diary");
    } catch {
      // The local save message explains how to retry.
    } finally {
      setStartingReport(false);
    }
  }

  function openCamera(replace = "") {
    setRetakeId(replace);
    setNotice("");
    setStage("camera");
  }

  function editPhoto(id?: string) {
    const first = id ? photos.find((photo) => photo.row.id === id) : photos[0];
    if (!first) return;
    setCurrentId(first.row.id);
    setStage(first.review === "checking" ? "captured" : "notes");
  }

  async function saveSettings(fields: ProjectFields) {
    await save((stored) => {
      const row = activeProject(stored) ?? {
        id: crypto.randomUUID(), user_id: owner, created_at: new Date().toISOString(),
      };
      stored.projects[row.id] = tracked({ ...row, ...fields });
      stored.activeProjectId = row.id;
    });
    void navigator.storage?.persist?.().catch(() => {});
    if (!project) navigate("diary");
  }

  async function capture({ blob, coords, capturedAt }: CameraCapture) {
    if (!project) throw new Error("Set the project name first.");
    const id = crypto.randomUUID();
    const path = assetPath(project, "photos", id);
    const token = navigator.onLine ? session?.access_token : undefined;

    await save((stored) => {
      const key = entryKey(project.id, day);
      const entry = stored.entries[key] ?? tracked({
        id: crypto.randomUUID(), user_id: owner, project_id: project.id,
        report_date: day, created_at: capturedAt,
      });
      stored.entries[key] = entry;
      const row: Photo = {
        id, user_id: owner, project_id: project.id, entry_id: entry.row.id,
        lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy,
        captured_at: capturedAt, note: "", description: "", description_approved_at: null,
        ai_ok: null, storage_path: path, size_bytes: blob.size,
      };
      const replaced = retakeId ? stored.photos[retakeId] : undefined;
      if (replaced && !replaced.deleted) {
        stored.photos[retakeId] = { ...replaced, ...tracked(replaced.row), deleted: true };
      }
      stored.photos[id] = { ...tracked(row), review: token ? "checking" : "unavailable", deleted: false };
      return {
        put: [[path, blob]],
      };
    });
    setCurrentId(id);
    setStage("captured");

    if (token) {
      void (async () => {
        let review: PhotoReview = "unavailable";
        let aiOk: boolean | null = null;
        let reason: string | undefined;
        try {
          const result = await checkPhoto(blob, token);
          aiOk = result.photo_ok;
          review = aiOk ? "clear" : "rejected";
          reason = result.reason;
        } catch {
          reason = "Gemini could not check this photo.";
        }
        await save((stored) => {
          const photo = stored.photos[id];
          if (!photo || photo.deleted || photo.review !== "checking") return;
          stored.photos[id] = { ...tracked({ ...photo.row, ai_ok: aiOk }), review, reason, deleted: false };
        });
      })().catch(() => {});
    }
  }

  async function savePhoto(id: string, patch: Partial<Pick<Photo, "note" | "description" | "description_approved_at">>) {
    await save((stored) => {
      const photo = stored.photos[id];
      if (!photo || photo.deleted) return;
      stored.photos[id] = { ...photo, ...tracked({ ...photo.row, description_approved_at: null, ...patch }) };
    });
  }

  async function writeDescription(photo: LocalPhoto, note: string) {
    if (!session?.access_token) throw new Error("Sign in to use Gemini.");
    const original = await getAsset(client, photo.row.storage_path);
    const result = await describePhoto(original, session.access_token, note);
    await savePhoto(photo.row.id, { description: result.description });
    return result.description;
  }

  async function approve(photo: LocalPhoto, description: string) {
    await savePhoto(photo.row.id, { description, description_approved_at: new Date().toISOString() });
    const next = photos[activeNumber];
    if (next) editPhoto(next.row.id);
    else setStage("list");
  }

  function removePhoto(photo: LocalPhoto) {
    if (!window.confirm("Delete this photo from the diary?")) return;
    void save((stored) => {
      const current = stored.photos[photo.row.id];
      if (!current) return;
      if (current.review === "checking") {
        delete stored.photos[photo.row.id];
        return { remove: [photo.row.storage_path] };
      }
      stored.photos[photo.row.id] = { ...current, ...tracked(current.row), deleted: true };
    }).then(() => setStage("list")).catch(() => {});
  }

  async function generate() {
    if (!project || !ready) return;
    setNotice("");
    setProgress("Preparing your report…");
    try {
      const { makeReport } = await import("../lib/pdf/report");
      const generated = await makeReport(project, day, photos.map(({ row }) => row), (path) => getAsset(client, path), setProgress);
      setFile(generated);
      setStage("preview");

      const id = crypto.randomUUID();
      const path = assetPath(project, "reports", id);
      await save((stored) => {
        stored.reports[id] = {
          ...tracked({
            id, project_id: project.id, user_id: owner, report_date: day, pdf_path: path,
            size_bytes: generated.size, created_at: new Date().toISOString(),
          }),
          filename: generated.name,
        };
        return { put: [[path, generated]] };
      }).catch(() => setNotice("The report is ready. Device storage could not keep a copy. Download it now."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The PDF could not be generated.");
    } finally {
      setProgress("");
    }
  }

  async function openReport(report: LocalReport) {
    if (!project) return;
    setProgress("Opening saved report…");
    setNotice("");
    try {
      const asset = await getAsset(client, report.row.pdf_path);
      setFile(new File([asset], report.filename ?? reportFilename(project.name, day), { type: "application/pdf" }));
      setStage("preview");
    } catch {
      setNotice("The saved PDF is unavailable here. Reconnect to sync, or regenerate it from the saved photos.");
    } finally {
      setProgress("");
    }
  }

  if (!diary) return <p className={localError ? "notice warning" : "muted"} role="status">{localError || "Opening your diary…"}</p>;

  return (
    <>
      <nav className="diary-nav" aria-label="Diary views">
        {(["diary", "history", "settings"] as const).map((view) => (
          <button key={view} type="button" onClick={() => navigate(view)}
            aria-current={tab === view ? "page" : undefined} disabled={Boolean(progress) || stage === "camera"}>
            {view === "diary" ? "Diary" : view === "history" ? "History" : "Settings"}
          </button>
        ))}
      </nav>
      {(issue || queue > 0) && <div className={"notice sync" + (issue ? " warning" : "")} role="status">
        <div>
          {issue && <p>{syncMessages[issue]}</p>}
          <p>{syncing ? "Syncing… " : ""}{queue + (queue === 1 ? " item waiting to sync" : " items waiting to sync")}</p>
        </div>
        <div className="actions">
          <button type="button" className="button" disabled={syncing} onClick={() => void retry()}>Retry sync</button>
          {issue === "login" && <button type="button" className="button" onClick={() => setReconnect(true)}>Sign in again</button>}
        </div>
      </div>}
      {localError && <p className="notice warning" role="alert">{localError}</p>}
      {notice && <p className="notice warning" role="alert">{notice}</p>}
      {reconnect ? <Login signIn={signIn} onDone={() => { setReconnect(false); void retry(); }} onCancel={() => setReconnect(false)} />
        : !project && !checkedCloud ? <p className="muted" role="status">Checking for your project…</p>
        : tab === "settings" || !project ? <Settings key={project?.id ?? "new"} project={project ?? null}
            save={saveSettings} signOut={signOut} client={client} online={Boolean(session) && issue !== "offline"} syncing={syncing} />
        : tab === "history" ? <section className="flow-section">
            <h1>History</h1>
            <label className="field-label">Open a report day
              <input type="date" max={localDay()} value={day} onChange={(event) => void openDay(event.target.value).catch(() => {})} />
            </label>
            {Object.keys(diary.entries).length ? <ul className="history-list">
              {Object.values(diary.entries)
                .map(({ row }) => row)
                .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.created_at.localeCompare(a.created_at))
                .map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => void openDay(entry.report_date, entry.project_id).catch(() => {})}>
                      <span className="history-day">
                        <strong>{diary.projects[entry.project_id]?.row.name ?? "Project"}</strong>
                        <span className="muted">{reportDate(entry.report_date)}</span>
                      </span>
                      <span className="muted">{photosForDay(diary, entry.project_id, entry.report_date).length} photos</span>
                    </button>
                  </li>
                ))}
            </ul> : <p className="muted">Captured report days will appear here.</p>}
          </section>
        : <>
            <section className="day-heading">
              <div>
                <h1>{day === localDay() ? "Today" : date}</h1>
                <p className="day-meta">{day === localDay() ? date + " · " : ""}{project.name}</p>
              </div>
              {day !== localDay() && <button type="button" className="button" onClick={() => void openDay(localDay()).catch(() => {})}>Go to today</button>}
            </section>
            {progress && <p className="notice" role="status">{progress}</p>}
            {progress && stage !== "preview" ? null : stage === "camera" ? <Camera onCapture={capture} onCancel={() => setStage(retakeId && active ? "captured" : "list")} />
              : stage === "captured" && active ? <section className="flow-section">
                  <h2>Photo {activeNumber}</h2>
                  <PhotoImage key={active.row.id} client={client} path={active.row.storage_path} alt={"Site photo " + activeNumber} />
                  <p className="muted">{captureTime(active.row.captured_at)} · Location ±{Math.round(active.row.accuracy)} m</p>
                  {active.row.accuracy > poorAccuracyMetres && <p className="notice warning">Location accuracy is low. The recorded location is shown in the report.</p>}
                  {active.review === "checking" && <p role="status" className="muted">Checking the photo…</p>}
                  {active.review === "rejected" && <p role="alert" className="notice warning"><strong>Gemini suggests a retake.</strong>{active.reason ? " · " + active.reason : ""}</p>}
                  {active.review === "unavailable" && <p className="muted">Photo check unavailable. Review the image yourself.</p>}
                  <div className="actions">
                    <button type="button" className={active.review === "rejected" ? "button" : "button primary"} disabled={checking} onClick={() => openCamera()}>+ Add photo</button>
                    <button type="button" className={active.review === "rejected" ? "button primary" : "button"} disabled={checking} onClick={() => editPhoto()}>
                      {active.review === "rejected" ? "Keep photo and continue" : "Done"}
                    </button>
                    {active.review === "rejected" && <button type="button" className="button" onClick={() => openCamera(active.row.id)}>Retake photo</button>}
                    <button type="button" className="text-button danger" onClick={() => removePhoto(active)}>Delete photo</button>
                  </div>
                </section>
              : stage === "notes" && active ? <NoteEditor key={active.row.id} photo={active} number={activeNumber} count={photos.length}
                  client={client} canUseAi={canUseAi} onSave={(change) => savePhoto(active.row.id, change)}
                  onDescribe={(note) => writeDescription(active, note)} onApprove={(description) => approve(active, description)}
                  onDelete={() => removePhoto(active)} onBack={() => setStage("list")} />
              : stage === "preview" && file ? <PdfPreview file={file} onEdit={() => editPhoto()} onBack={() => setStage("list")} onStartReport={reports.length && !progress ? showNewReport : undefined} />
              : <section className="flow-section" aria-labelledby="day-photos">
                  <div className="section-row">
                    <h2 id="day-photos">Site photos <span className="count">{photos.length}</span></h2>
                    <div className="actions">
                      <button type="button" className="button primary" disabled={newReport} onClick={() => openCamera()}>{photos.length ? "+ Add photos" : "Open camera"}</button>
                      {reports.length > 0 && <button type="button" className="button" aria-expanded={newReport} onClick={showNewReport}>Start new report</button>}
                    </div>
                  </div>
                  {newReport && <form className="form-stack report-start" onSubmit={startReport} aria-label="Start new report">
                    <label>Project name<input name="name" autoFocus required maxLength={64} disabled={startingReport} /></label>
                    <p className="muted">This opens an empty draft for today. Previous photos and PDFs stay in History.</p>
                    <div className="actions">
                      <button type="submit" className="button primary" disabled={startingReport}>{startingReport ? "Starting…" : "Start report"}</button>
                      <button type="button" className="button" disabled={startingReport} onClick={() => { setNewReport(false); setNotice(""); }}>Cancel</button>
                    </div>
                  </form>}
                  {!photos.length ? <p className="muted">Take a live photo to start this day’s report.</p>
                    : <ol className="photo-list">
                        {photos.map((photo, index) => (
                          <li key={photo.row.id}>
                            <PhotoImage client={client} path={photo.row.storage_path} className="thumbnail" alt={"Site photo " + (index + 1)} />
                            <div className="photo-summary">
                              <strong>Photo {index + 1}</strong>
                              <span className="muted">{captureTime(photo.row.captured_at)}</span>
                              <span className="photo-status">{photo.review === "checking" ? "Checking photo" : photo.row.description_approved_at ? "Approved" : photo.review === "rejected" ? "Gemini suggested a retake" : "Needs description"}</span>
                            </div>
                            <button type="button" className="button" disabled={Boolean(progress)} onClick={() => editPhoto(photo.row.id)}
                              aria-label={"Edit photo " + (index + 1)}>Edit</button>
                          </li>
                        ))}
                      </ol>}
                  {photos.length > 0 && <>
                    <div className="actions">
                      <button type="button" className="button primary" disabled={!ready || Boolean(progress)} onClick={() => void generate()}>
                        {day === localDay() ? "Generate today’s report" : "Generate report"}
                      </button>
                    </div>
                    {!ready && <p className="muted">Approve an English description for every photo to generate the report.</p>}
                  </>}
                  {reports.length > 0 && <div className="saved-reports">
                    <h3>Saved PDFs</h3>
                    {reports.map((report, index) => <button key={report.row.id} type="button" className="button"
                      disabled={Boolean(progress)} onClick={() => void openReport(report)}>
                      {index === 0 ? "Open latest PDF" : "Open PDF · " + captureTime(report.row.created_at)}
                    </button>)}
                  </div>}
                </section>}
          </>}
    </>
  );
}
