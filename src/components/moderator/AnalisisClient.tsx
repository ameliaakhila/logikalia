"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ModeratorNav } from "@/components/moderator/ModeratorNav";
import type { AnalisisClass } from "@/app/(moderator)/moderator/analisis/page";
import {
  computeAnalisisMetrics,
  type StudentAnalytics,
} from "@/lib/moderator/analisis-metrics";
import {
  ArrowUpCircle,
  Award,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Lightbulb,
  ListChecks,
  Sliders,
  Target,
} from "lucide-react";

const NO_CLASS_KEY = "__tanpa_kelas__";

interface AnalisisClientProps {
  students: StudentAnalytics[];
  classes: AnalisisClass[];
}

export function AnalisisClient({ students, classes }: AnalisisClientProps) {
  const classOptions = useMemo(() => {
    const names = new Set(classes.map((c) => c.name));
    for (const s of students) {
      if (s.className) names.add(s.className);
    }
    const options = Array.from(names).map((name) => ({
      key: name,
      label: name,
    }));
    if (students.some((s) => !s.className)) {
      options.push({ key: NO_CLASS_KEY, label: "Tanpa Kelas" });
    }
    return options;
  }, [classes, students]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(classOptions.map((o) => o.key)),
  );

  const toggleClass = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const filteredStudents = useMemo(
    () =>
      students.filter((s) => selected.has(s.className ?? NO_CLASS_KEY)),
    [students, selected],
  );

  const data = useMemo(
    () => computeAnalisisMetrics(filteredStudents),
    [filteredStudents],
  );

  const allSelected = selected.size === classOptions.length;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <ModeratorNav active="analisis" />

      <div>
        <h1 className="text-2xl font-bold">Analisis Sistem</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ringkasan performa pembelajaran dari {data.totalSiswaAktif} siswa
          aktif
          {!allSelected &&
            ` (dari ${filteredStudents.length} siswa terpilih di ${selected.size} kelas)`}
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filter Kelas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(new Set(classOptions.map((o) => o.key)))
                }
              >
                Pilih Semua
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Kosongkan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {classOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada data kelas.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {classOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <Checkbox
                    checked={selected.has(option.key)}
                    onCheckedChange={(checked) =>
                      toggleClass(option.key, checked)
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={ListChecks}
          label="Rata-rata Soal Diselesaikan"
          value={data.avgSoalDiselesaikan.toFixed(1)}
          sub="soal per siswa"
        />
        <MetricCard
          icon={Target}
          label="Tingkat Keberhasilan"
          value={`${data.tingkatKeberhasilan.toFixed(1)}%`}
          sub="dari seluruh percobaan soal"
        />
        <MetricCard
          icon={Lightbulb}
          label="Penggunaan Hint"
          value={data.avgHintPerSiswa.toFixed(1)}
          sub="penggunaan per siswa"
        />
        <MetricCard
          icon={Award}
          label="Reward Rata-rata"
          value={data.avgReward.toFixed(3)}
          sub="sinyal reward RL per percobaan"
        />
        <MetricCard
          icon={Database}
          label="Pembaruan Q-value"
          value={data.totalPembaruanQValue}
          sub="total update tabel Q dari siswa terpilih"
        />
        <MetricCard
          icon={Clock}
          label="Rata-rata Waktu Penggunaan"
          value={`${data.avgWaktuMenitPerSiswa.toFixed(0)} menit`}
          sub="per siswa"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Aktivitas Diselesaikan"
          value={data.siswaSelesaiSemuaLevel}
          sub="siswa menyelesaikan seluruh level pembelajaran"
        />
        <MetricCard
          icon={Sliders}
          label="Adaptasi Tingkat Kesulitan"
          value={data.totalAdaptasiKesulitan}
          sub="kali penyesuaian berdasarkan performa siswa"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
            Perubahan Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <LevelStat
              label="Naik Level"
              value={data.perubahanLevel.naik}
              tone="positive"
            />
            <LevelStat
              label="Tetap"
              value={data.perubahanLevel.tetap}
              tone="neutral"
            />
            <LevelStat
              label="Turun Level"
              value={data.perubahanLevel.turun}
              tone="negative"
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {data.perubahanLevel.naik} siswa naik level, {data.perubahanLevel.tetap} siswa
            tetap pada level awal
            {data.perubahanLevel.turun > 0
              ? `, ${data.perubahanLevel.turun} siswa turun level`
              : ""}
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          </div>
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function LevelStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "neutral" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div className="text-center">
      <div className={`font-mono text-2xl font-bold ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
