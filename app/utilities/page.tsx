"use client";

import { useState, useEffect, useMemo } from "react";
import SoftwareLayout from "@/components/SoftwareLayout";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface Godown {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

interface Rack {
  id: string;
  rackNumber: string;
  numericValue: number;
  createdAt: number;
}

interface SerialNumberItem {
  id: string;
  serialNumber: string;
  numericValue: number;
  status: string;
  createdAt: number;
}

type TabType = "godowns" | "racks" | "serials";

export default function UtilitiesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("godowns");

  // ----------------------------------------------------
  // GODOWNS STATE
  // ----------------------------------------------------
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loadingGodowns, setLoadingGodowns] = useState(true);
  const [searchGodown, setSearchGodown] = useState("");
  const [isGodownModalOpen, setIsGodownModalOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [godownName, setGodownName] = useState("");
  const [godownAddress, setGodownAddress] = useState("");
  const [savingGodown, setSavingGodown] = useState(false);
  const [godownToDelete, setGodownToDelete] = useState<Godown | null>(null);
  const [deletingGodown, setDeletingGodown] = useState(false);

  // ----------------------------------------------------
  // RACKS STATE
  // ----------------------------------------------------
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loadingRacks, setLoadingRacks] = useState(true);
  const [rackNextStart, setRackNextStart] = useState<number>(1);
  const [searchRack, setSearchRack] = useState("");
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
  const [isSingleRackModalOpen, setIsSingleRackModalOpen] = useState(false);
  const [isBulkRackModalOpen, setIsBulkRackModalOpen] = useState(false);
  const [singleRackNumber, setSingleRackNumber] = useState("");
  const [savingSingleRack, setSavingSingleRack] = useState(false);
  // Bulk Rack Fields
  const [bulkRackEnd, setBulkRackEnd] = useState<string>("");
  const [bulkRackPrefix, setBulkRackPrefix] = useState<string>("R-");
  const [savingBulkRacks, setSavingBulkRacks] = useState(false);
  const [rackToDelete, setRackToDelete] = useState<Rack | null>(null);
  const [isBulkDeleteRacksConfirm, setIsBulkDeleteRacksConfirm] = useState(false);
  const [deletingRacks, setDeletingRacks] = useState(false);

  // ----------------------------------------------------
  // SERIAL NUMBERS STATE
  // ----------------------------------------------------
  const [serials, setSerials] = useState<SerialNumberItem[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(true);
  const [serialNextStart, setSerialNextStart] = useState<number>(1);
  const [searchSerial, setSearchSerial] = useState("");
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [isSingleSerialModalOpen, setIsSingleSerialModalOpen] = useState(false);
  const [isBulkSerialModalOpen, setIsBulkSerialModalOpen] = useState(false);
  const [singleSerialNumber, setSingleSerialNumber] = useState("");
  const [savingSingleSerial, setSavingSingleSerial] = useState(false);
  // Bulk Serial Fields
  const [bulkSerialEnd, setBulkSerialEnd] = useState<string>("");
  const [bulkSerialPrefix, setBulkSerialPrefix] = useState<string>("SN-");
  const [savingBulkSerials, setSavingBulkSerials] = useState(false);
  const [serialToDelete, setSerialToDelete] = useState<SerialNumberItem | null>(null);
  const [isBulkDeleteSerialsConfirm, setIsBulkDeleteSerialsConfirm] = useState(false);
  const [deletingSerials, setDeletingSerials] = useState(false);

  // ----------------------------------------------------
  // FETCHERS
  // ----------------------------------------------------
  const fetchGodowns = async () => {
    setLoadingGodowns(true);
    try {
      const res = await fetch("/api/utilities/godowns");
      const data = await res.json();
      if (data.success && Array.isArray(data.godowns)) {
        setGodowns(data.godowns);
      }
    } catch {
      toast.error("Failed to load godowns.");
    } finally {
      setLoadingGodowns(false);
    }
  };

  const fetchRacks = async () => {
    setLoadingRacks(true);
    try {
      const res = await fetch("/api/utilities/racks");
      const data = await res.json();
      if (data.success && Array.isArray(data.racks)) {
        setRacks(data.racks);
        if (typeof data.nextStartNumber === "number") {
          setRackNextStart(data.nextStartNumber);
        }
      }
    } catch {
      toast.error("Failed to load racks.");
    } finally {
      setLoadingRacks(false);
    }
  };

  const fetchSerials = async () => {
    setLoadingSerials(true);
    try {
      const res = await fetch("/api/utilities/serial-numbers");
      const data = await res.json();
      if (data.success && Array.isArray(data.serialNumbers)) {
        setSerials(data.serialNumbers);
        if (typeof data.nextStartNumber === "number") {
          setSerialNextStart(data.nextStartNumber);
        }
      }
    } catch {
      toast.error("Failed to load serial numbers.");
    } finally {
      setLoadingSerials(false);
    }
  };

  useEffect(() => {
    fetchGodowns();
    fetchRacks();
    fetchSerials();
  }, []);

  // ----------------------------------------------------
  // GODOWN HANDLERS
  // ----------------------------------------------------
  const openAddGodownModal = () => {
    setEditingGodown(null);
    setGodownName("");
    setGodownAddress("");
    setIsGodownModalOpen(true);
  };

  const openEditGodownModal = (g: Godown) => {
    setEditingGodown(g);
    setGodownName(g.name);
    setGodownAddress(g.address);
    setIsGodownModalOpen(true);
  };

  const handleSaveGodown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!godownName.trim()) {
      toast.error("Godown name is required.");
      return;
    }

    setSavingGodown(true);
    try {
      const url = "/api/utilities/godowns";
      const method = editingGodown ? "PUT" : "POST";
      const payload = editingGodown
        ? { id: editingGodown.id, name: godownName.trim(), address: godownAddress.trim() }
        : { name: godownName.trim(), address: godownAddress.trim() };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save godown.");
      } else {
        toast.success(
          editingGodown
            ? `Godown "${godownName.trim()}" updated successfully!`
            : `Godown "${godownName.trim()}" created successfully!`
        );
        setIsGodownModalOpen(false);
        fetchGodowns();
      }
    } catch {
      toast.error("Network error saving godown.");
    } finally {
      setSavingGodown(false);
    }
  };

  const handleConfirmDeleteGodown = async () => {
    if (!godownToDelete) return;
    setDeletingGodown(true);
    try {
      const res = await fetch(`/api/utilities/godowns?id=${godownToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Godown "${godownToDelete.name}" deleted successfully.`);
        setGodowns((prev) => prev.filter((g) => g.id !== godownToDelete.id));
        setGodownToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete godown.");
      }
    } catch {
      toast.error("Network error while deleting godown.");
    } finally {
      setDeletingGodown(false);
    }
  };

  // ----------------------------------------------------
  // RACKS HANDLERS
  // ----------------------------------------------------
  const openAddSingleRackModal = () => {
    setSingleRackNumber(bulkRackPrefix ? `${bulkRackPrefix}${rackNextStart}` : String(rackNextStart));
    setIsSingleRackModalOpen(true);
  };

  const openBulkRackModal = () => {
    setBulkRackEnd(String(rackNextStart + 9)); // default creates 10
    setIsBulkRackModalOpen(true);
  };

  const handleSaveSingleRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleRackNumber.trim()) {
      toast.error("Rack number is required.");
      return;
    }

    setSavingSingleRack(true);
    try {
      const res = await fetch("/api/utilities/racks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          rackNumber: singleRackNumber.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save rack.");
      } else {
        toast.success(`Rack "${singleRackNumber.trim()}" added successfully!`);
        setIsSingleRackModalOpen(false);
        fetchRacks();
      }
    } catch {
      toast.error("Network error saving rack.");
    } finally {
      setSavingSingleRack(false);
    }
  };

  const handleSaveBulkRacks = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = rackNextStart;
    const endNum = parseInt(bulkRackEnd, 10);

    if (isNaN(endNum) || endNum < startNum) {
      toast.error(`End number must be greater than or equal to start number (${startNum}).`);
      return;
    }
    if (endNum - startNum + 1 > 2000) {
      toast.error("Maximum 2,000 racks can be generated at once.");
      return;
    }

    setSavingBulkRacks(true);
    try {
      const res = await fetch("/api/utilities/racks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bulk",
          startNumber: startNum,
          endNumber: endNum,
          prefix: bulkRackPrefix.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create racks in bulk.");
      } else {
        toast.success(data.message || `Successfully created ${data.createdCount} racks!`);
        setIsBulkRackModalOpen(false);
        fetchRacks();
      }
    } catch {
      toast.error("Network error while bulk creating racks.");
    } finally {
      setSavingBulkRacks(false);
    }
  };

  const handleConfirmDeleteSingleRack = async () => {
    if (!rackToDelete) return;
    setDeletingRacks(true);
    try {
      const res = await fetch(`/api/utilities/racks?id=${rackToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Rack "${rackToDelete.rackNumber}" deleted.`);
        setRacks((prev) => prev.filter((r) => r.id !== rackToDelete.id));
        setSelectedRackIds((prev) => prev.filter((id) => id !== rackToDelete.id));
        setRackToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete rack.");
      }
    } catch {
      toast.error("Network error while deleting rack.");
    } finally {
      setDeletingRacks(false);
    }
  };

  const handleConfirmDeleteBulkRacks = async () => {
    if (selectedRackIds.length === 0) return;
    setDeletingRacks(true);
    try {
      const res = await fetch("/api/utilities/racks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRackIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${selectedRackIds.length} racks successfully.`);
        setRacks((prev) => prev.filter((r) => !selectedRackIds.includes(r.id)));
        setSelectedRackIds([]);
        setIsBulkDeleteRacksConfirm(false);
      } else {
        toast.error(data.error || "Failed to delete selected racks.");
      }
    } catch {
      toast.error("Network error while deleting racks.");
    } finally {
      setDeletingRacks(false);
    }
  };

  // ----------------------------------------------------
  // SERIAL NUMBERS HANDLERS
  // ----------------------------------------------------
  const openAddSingleSerialModal = () => {
    setSingleSerialNumber(
      bulkSerialPrefix ? `${bulkSerialPrefix}${serialNextStart}` : String(serialNextStart)
    );
    setIsSingleSerialModalOpen(true);
  };

  const openBulkSerialModal = () => {
    setBulkSerialEnd(String(serialNextStart + 9)); // default creates 10
    setIsBulkSerialModalOpen(true);
  };

  const handleSaveSingleSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSerialNumber.trim()) {
      toast.error("Serial number is required.");
      return;
    }

    setSavingSingleSerial(true);
    try {
      const res = await fetch("/api/utilities/serial-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          serialNumber: singleSerialNumber.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save serial number.");
      } else {
        toast.success(`Serial number "${singleSerialNumber.trim()}" added!`);
        setIsSingleSerialModalOpen(false);
        fetchSerials();
      }
    } catch {
      toast.error("Network error saving serial number.");
    } finally {
      setSavingSingleSerial(false);
    }
  };

  const handleSaveBulkSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = serialNextStart;
    const endNum = parseInt(bulkSerialEnd, 10);

    if (isNaN(endNum) || endNum < startNum) {
      toast.error(`End number must be greater than or equal to start number (${startNum}).`);
      return;
    }
    if (endNum - startNum + 1 > 2000) {
      toast.error("Maximum 2,000 serial numbers can be generated at once.");
      return;
    }

    setSavingBulkSerials(true);
    try {
      const res = await fetch("/api/utilities/serial-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bulk",
          startNumber: startNum,
          endNumber: endNum,
          prefix: bulkSerialPrefix.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create serial numbers in bulk.");
      } else {
        toast.success(data.message || `Successfully created ${data.createdCount} serial numbers!`);
        setIsBulkSerialModalOpen(false);
        fetchSerials();
      }
    } catch {
      toast.error("Network error while bulk creating serial numbers.");
    } finally {
      setSavingBulkSerials(false);
    }
  };

  const handleConfirmDeleteSingleSerial = async () => {
    if (!serialToDelete) return;
    setDeletingSerials(true);
    try {
      const res = await fetch(`/api/utilities/serial-numbers?id=${serialToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Serial "${serialToDelete.serialNumber}" deleted.`);
        setSerials((prev) => prev.filter((s) => s.id !== serialToDelete.id));
        setSelectedSerialIds((prev) => prev.filter((id) => id !== serialToDelete.id));
        setSerialToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete serial number.");
      }
    } catch {
      toast.error("Network error while deleting serial number.");
    } finally {
      setDeletingSerials(false);
    }
  };

  const handleConfirmDeleteBulkSerials = async () => {
    if (selectedSerialIds.length === 0) return;
    setDeletingSerials(true);
    try {
      const res = await fetch("/api/utilities/serial-numbers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSerialIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${selectedSerialIds.length} serial numbers.`);
        setSerials((prev) => prev.filter((s) => !selectedSerialIds.includes(s.id)));
        setSelectedSerialIds([]);
        setIsBulkDeleteSerialsConfirm(false);
      } else {
        toast.error(data.error || "Failed to delete selected serial numbers.");
      }
    } catch {
      toast.error("Network error while deleting serial numbers.");
    } finally {
      setDeletingSerials(false);
    }
  };

  // ----------------------------------------------------
  // FILTERED LISTS
  // ----------------------------------------------------
  const filteredGodowns = useMemo(() => {
    const term = searchGodown.toLowerCase().trim();
    if (!term) return godowns;
    return godowns.filter(
      (g) =>
        g.name.toLowerCase().includes(term) || (g.address && g.address.toLowerCase().includes(term))
    );
  }, [godowns, searchGodown]);

  const filteredRacks = useMemo(() => {
    const term = searchRack.toLowerCase().trim();
    if (!term) return racks;
    return racks.filter((r) => r.rackNumber.toLowerCase().includes(term));
  }, [racks, searchRack]);

  const filteredSerials = useMemo(() => {
    const term = searchSerial.toLowerCase().trim();
    if (!term) return serials;
    return serials.filter((s) => s.serialNumber.toLowerCase().includes(term));
  }, [serials, searchSerial]);

  // Bulk rack preview calculations (Start is fixed to rackNextStart)
  const bulkRackPreviewCount = useMemo(() => {
    const s = rackNextStart;
    const e = parseInt(bulkRackEnd, 10);
    if (isNaN(e) || e < s) return 0;
    return e - s + 1;
  }, [rackNextStart, bulkRackEnd]);

  // Bulk serial preview calculations (Start is fixed to serialNextStart)
  const bulkSerialPreviewCount = useMemo(() => {
    const s = serialNextStart;
    const e = parseInt(bulkSerialEnd, 10);
    if (isNaN(e) || e < s) return 0;
    return e - s + 1;
  }, [serialNextStart, bulkSerialEnd]);

  return (
    <SoftwareLayout>
      <div className="w-full flex flex-col font-sans">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-slate-900 tracking-tight">Utilities</h1>
              <span className="bg-[#5e2b9d]/10 text-[#5e2b9d] text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]">
                Warehouse & Sequence Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage your godowns, storage racks, and product serial number sequences.
            </p>
          </div>
        </div>

        {/* Tab Switcher Bar */}
        <div className="bg-white rounded-[8px] border border-slate-200 p-1.5 mb-5 flex items-center gap-1.5 shadow-2xs">
          {/* Tab 1: Godowns */}
          <button
            type="button"
            onClick={() => setActiveTab("godowns")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-xs font-medium transition-all cursor-pointer ${
              activeTab === "godowns"
                ? "bg-[#5e2b9d] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Godowns</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "godowns"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {godowns.length}
            </span>
          </button>

          {/* Tab 2: Racks */}
          <button
            type="button"
            onClick={() => setActiveTab("racks")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-xs font-medium transition-all cursor-pointer ${
              activeTab === "racks"
                ? "bg-[#5e2b9d] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <span>Racks</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "racks"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {racks.length}
            </span>
          </button>

          {/* Tab 3: Serial Numbers */}
          <button
            type="button"
            onClick={() => setActiveTab("serials")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-xs font-medium transition-all cursor-pointer ${
              activeTab === "serials"
                ? "bg-[#5e2b9d] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
            <span>Serial Numbers</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "serials"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {serials.length}
            </span>
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 1: GODOWNS VIEW */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "godowns" && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-2xs">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Search godowns by name or address..."
                  value={searchGodown}
                  onChange={(e) => setSearchGodown(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
                />
                <svg
                  className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openAddGodownModal}
                  className="h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Godown</span>
                </button>
              </div>
            </div>

            {/* Godowns Table */}
            {loadingGodowns ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-12 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs text-slate-500">Loading godowns...</span>
              </div>
            ) : filteredGodowns.length === 0 ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800 mb-1">
                  {searchGodown ? "No matching godowns found" : "No Godowns Created Yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  {searchGodown
                    ? "Try adjusting your search query."
                    : "Add your main storage warehouses, depots, or facility locations."}
                </p>
                {!searchGodown && (
                  <button
                    type="button"
                    onClick={openAddGodownModal}
                    className="h-[32px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium px-4 rounded-[6px] transition-colors cursor-pointer"
                  >
                    + Add First Godown
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-12 text-center">#</th>
                        <th className="py-2.5 px-4">Godown Name</th>
                        <th className="py-2.5 px-4">Address</th>
                        <th className="py-2.5 px-4">Created Date</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredGodowns.map((g, idx) => (
                        <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-purple-50 text-[#5e2b9d] flex items-center justify-center font-bold text-xs flex-shrink-0">
                                <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                  />
                                </svg>
                              </div>
                              <span className="font-semibold text-slate-900">{g.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs text-slate-600">
                            {g.address ? (
                              <div className="flex items-start gap-1.5">
                                <svg
                                  className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                <span className="line-clamp-2 leading-relaxed">{g.address}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No address provided</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditGodownModal(g)}
                                className="p-1.5 text-slate-500 hover:text-[#5e2b9d] hover:bg-purple-50 rounded-[4px] transition-colors cursor-pointer"
                                title="Edit Godown"
                              >
                                <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setGodownToDelete(g)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-colors cursor-pointer"
                                title="Delete Godown"
                              >
                                <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 2: RACKS VIEW */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "racks" && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <input
                    type="text"
                    placeholder="Search rack number..."
                    value={searchRack}
                    onChange={(e) => setSearchRack(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
                  />
                  <svg
                    className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Auto start indicator */}
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Next Auto #: <strong className="text-slate-800 font-mono">#{rackNextStart}</strong>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedRackIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleteRacksConfirm(true)}
                    className="h-[34px] px-3 rounded-[6px] bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>Delete Selected ({selectedRackIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={openAddSingleRackModal}
                  className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.2] text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Single Rack</span>
                </button>

                <button
                  type="button"
                  onClick={openBulkRackModal}
                  className="h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>+ Bulk Create Racks</span>
                </button>
              </div>
            </div>

            {/* Racks Table */}
            {loadingRacks ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-12 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs text-slate-500">Loading racks...</span>
              </div>
            ) : filteredRacks.length === 0 ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800 mb-1">
                  {searchRack ? "No matching racks found" : "No Racks Created Yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  {searchRack
                    ? "Try adjusting your rack search keyword."
                    : "Create storage racks or use Bulk Create to auto-generate racks in sequence."}
                </p>
                {!searchRack && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openAddSingleRackModal}
                      className="h-[32px] px-3.5 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Add Single Rack
                    </button>
                    <button
                      type="button"
                      onClick={openBulkRackModal}
                      className="h-[32px] px-3.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-[6px] text-xs font-medium cursor-pointer"
                    >
                      + Bulk Create Racks
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredRacks.length > 0 &&
                              filteredRacks.every((r) => selectedRackIds.includes(r.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allFilteredIds = filteredRacks.map((r) => r.id);
                                setSelectedRackIds(Array.from(new Set([...selectedRackIds, ...allFilteredIds])));
                              } else {
                                const filteredSet = new Set(filteredRacks.map((r) => r.id));
                                setSelectedRackIds(selectedRackIds.filter((id) => !filteredSet.has(id)));
                              }
                            }}
                            className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-4">Rack Number</th>
                        <th className="py-2.5 px-4">Sequence #</th>
                        <th className="py-2.5 px-4">Created Date</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredRacks.map((r) => {
                        const isChecked = selectedRackIds.includes(r.id);
                        return (
                          <tr
                            key={r.id}
                            className={`hover:bg-slate-50/60 transition-colors ${
                              isChecked ? "bg-purple-50/40" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRackIds([...selectedRackIds, r.id]);
                                  } else {
                                    setSelectedRackIds(selectedRackIds.filter((id) => id !== r.id));
                                  }
                                }}
                                className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 font-mono font-semibold text-xs border border-slate-200">
                                {r.rackNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              #{r.numericValue || "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setRackToDelete(r)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-colors cursor-pointer"
                                title="Delete Rack"
                              >
                                <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 3: SERIAL NUMBERS VIEW */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "serials" && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <input
                    type="text"
                    placeholder="Search serial number..."
                    value={searchSerial}
                    onChange={(e) => setSearchSerial(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
                  />
                  <svg
                    className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Next Auto #: <strong className="text-slate-800 font-mono">#{serialNextStart}</strong>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedSerialIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleteSerialsConfirm(true)}
                    className="h-[34px] px-3 rounded-[6px] bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>Delete Selected ({selectedSerialIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={openAddSingleSerialModal}
                  className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.2] text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Single Serial</span>
                </button>

                <button
                  type="button"
                  onClick={openBulkSerialModal}
                  className="h-[34px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white font-medium text-xs px-3.5 rounded-[6px] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span>+ Bulk Create Serials</span>
                </button>
              </div>
            </div>

            {/* Serials Table */}
            {loadingSerials ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-12 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#5e2b9d] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs text-slate-500">Loading serial numbers...</span>
              </div>
            ) : filteredSerials.length === 0 ? (
              <div className="w-full bg-white rounded-[8px] border border-slate-200 p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800 mb-1">
                  {searchSerial ? "No matching serial numbers found" : "No Serial Numbers Created Yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  {searchSerial
                    ? "Try adjusting your search criteria."
                    : "Add serial numbers manually or bulk generate sequential serial numbers."}
                </p>
                {!searchSerial && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openAddSingleSerialModal}
                      className="h-[32px] px-3.5 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Add Single Serial
                    </button>
                    <button
                      type="button"
                      onClick={openBulkSerialModal}
                      className="h-[32px] px-3.5 bg-[#5e2b9d] hover:bg-[#4e2284] text-white rounded-[6px] text-xs font-medium cursor-pointer"
                    >
                      + Bulk Create Serials
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredSerials.length > 0 &&
                              filteredSerials.every((s) => selectedSerialIds.includes(s.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allFilteredIds = filteredSerials.map((s) => s.id);
                                setSelectedSerialIds(Array.from(new Set([...selectedSerialIds, ...allFilteredIds])));
                              } else {
                                const filteredSet = new Set(filteredSerials.map((s) => s.id));
                                setSelectedSerialIds(selectedSerialIds.filter((id) => !filteredSet.has(id)));
                              }
                            }}
                            className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-4">Serial Number</th>
                        <th className="py-2.5 px-4">Sequence Value</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Created Date</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredSerials.map((s) => {
                        const isChecked = selectedSerialIds.includes(s.id);
                        return (
                          <tr
                            key={s.id}
                            className={`hover:bg-slate-50/60 transition-colors ${
                              isChecked ? "bg-purple-50/40" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSerialIds([...selectedSerialIds, s.id]);
                                  } else {
                                    setSelectedSerialIds(selectedSerialIds.filter((id) => id !== s.id));
                                  }
                                }}
                                className="rounded text-[#5e2b9d] focus:ring-[#5e2b9d] cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-900 font-mono font-semibold text-xs border border-slate-200">
                                {s.serialNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              #{s.numericValue || "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {s.status || "Available"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSerialToDelete(s)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-colors cursor-pointer"
                                title="Delete Serial Number"
                              >
                                <svg className="w-3.5 h-3.5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODAL: ADD / EDIT GODOWN */}
        {/* ---------------------------------------------------------------- */}
        {isGodownModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      {editingGodown ? "Edit Godown" : "Add New Godown"}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Store storage facility or backroom.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGodownModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveGodown} className="p-4 flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Godown Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Central Warehouse, Main Godown"
                    value={godownName}
                    onChange={(e) => setGodownName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Address / Location Details
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g., Plot 42, Sector 8, Industrial Area, Hyderabad"
                    value={godownAddress}
                    onChange={(e) => setGodownAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsGodownModalOpen(false)}
                    disabled={savingGodown}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingGodown}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {savingGodown ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingGodown ? "Update Godown" : "Save Godown"}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODAL: ADD SINGLE RACK */}
        {/* ---------------------------------------------------------------- */}
        {isSingleRackModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      Add Single Rack
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Create an individual storage rack.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSingleRackModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveSingleRack} className="p-4 flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Rack Number / Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R-101 or 101"
                    value={singleRackNumber}
                    onChange={(e) => setSingleRackNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSingleRackModalOpen(false)}
                    disabled={savingSingleRack}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSingleRack}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {savingSingleRack ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Rack</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODAL: BULK CREATE RACKS */}
        {/* ---------------------------------------------------------------- */}
        {isBulkRackModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      Bulk Create Racks
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Auto-sequence racks in batch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkRackModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveBulkRacks} className="p-4 flex flex-col gap-4">
                <div className="p-2.5 rounded-[6px] bg-purple-50/70 border border-purple-100 flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#5e2b9d] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-[11.5px] text-[#5e2b9d] leading-relaxed">
                    <strong>Auto Start Number:</strong> Starts automatically from <strong>#{rackNextStart}</strong>{" "}
                    (highest existing rack is #{rackNextStart > 1 ? rackNextStart - 1 : 0}). Start number is fixed to maintain continuous sequence.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Prefix (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. R- or Rack-"
                      value={bulkRackPrefix}
                      onChange={(e) => setBulkRackPrefix(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                      <span>Start Number</span>
                      <span className="text-[10px] text-slate-400 font-normal">Locked</span>
                    </label>
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={rackNextStart}
                      className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-[6px] text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      End Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={rackNextStart}
                      placeholder={`Min ${rackNextStart}`}
                      value={bulkRackEnd}
                      onChange={(e) => setBulkRackEnd(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Generation Preview
                    </span>
                    <span className="text-xs font-bold text-[#5e2b9d]">
                      {bulkRackPreviewCount > 0
                        ? `${bulkRackPreviewCount} ${bulkRackPreviewCount === 1 ? "Rack" : "Racks"}`
                        : "Invalid range"}
                    </span>
                  </div>
                  {bulkRackPreviewCount > 0 ? (
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5 pt-1">
                      <span>Will create:</span>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                        {bulkRackPrefix}
                        {rackNextStart}
                      </span>
                      <span>to</span>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                        {bulkRackPrefix}
                        {bulkRackEnd}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Please enter an End Number &gt;= {rackNextStart}.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBulkRackModalOpen(false)}
                    disabled={savingBulkRacks}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBulkRacks || bulkRackPreviewCount <= 0}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {savingBulkRacks ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating {bulkRackPreviewCount} Racks...</span>
                      </>
                    ) : (
                      <span>Generate {bulkRackPreviewCount > 0 ? bulkRackPreviewCount : ""} Racks</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODAL: ADD SINGLE SERIAL NUMBER */}
        {/* ---------------------------------------------------------------- */}
        {isSingleSerialModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      Add Single Serial Number
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Create an individual tracking serial.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSingleSerialModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveSingleSerial} className="p-4 flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Serial Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SN-001 or 1001"
                    value={singleSerialNumber}
                    onChange={(e) => setSingleSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSingleSerialModalOpen(false)}
                    disabled={savingSingleSerial}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSingleSerial}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {savingSingleSerial ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Serial Number</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODAL: BULK CREATE SERIAL NUMBERS */}
        {/* ---------------------------------------------------------------- */}
        {isBulkSerialModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-[#5e2b9d] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      Bulk Create Serial Numbers
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Auto-generate serial numbers in batch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkSerialModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveBulkSerials} className="p-4 flex flex-col gap-4">
                <div className="p-2.5 rounded-[6px] bg-purple-50/70 border border-purple-100 flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#5e2b9d] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-[11.5px] text-[#5e2b9d] leading-relaxed">
                    <strong>Auto Start Number:</strong> Starts automatically from <strong>#{serialNextStart}</strong>{" "}
                    (highest existing serial is #{serialNextStart > 1 ? serialNextStart - 1 : 0}). Start number is fixed to maintain continuous sequence.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Prefix (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SN- or SER-"
                      value={bulkSerialPrefix}
                      onChange={(e) => setBulkSerialPrefix(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                      <span>Start Number</span>
                      <span className="text-[10px] text-slate-400 font-normal">Locked</span>
                    </label>
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={serialNextStart}
                      className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-[6px] text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      End Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={serialNextStart}
                      placeholder={`Min ${serialNextStart}`}
                      value={bulkSerialEnd}
                      onChange={(e) => setBulkSerialEnd(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#5e2b9d] focus:bg-white text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Generation Preview
                    </span>
                    <span className="text-xs font-bold text-[#5e2b9d]">
                      {bulkSerialPreviewCount > 0
                        ? `${bulkSerialPreviewCount} Serial Numbers`
                        : "Invalid range"}
                    </span>
                  </div>
                  {bulkSerialPreviewCount > 0 ? (
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5 pt-1">
                      <span>Will create:</span>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                        {bulkSerialPrefix}
                        {serialNextStart}
                      </span>
                      <span>to</span>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                        {bulkSerialPrefix}
                        {bulkSerialEnd}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Please enter an End Number &gt;= {serialNextStart}.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBulkSerialModalOpen(false)}
                    disabled={savingBulkSerials}
                    className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBulkSerials || bulkSerialPreviewCount <= 0}
                    className="h-[34px] px-4 rounded-[6px] bg-[#5e2b9d] hover:bg-[#4e2284] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {savingBulkSerials ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating {bulkSerialPreviewCount} Serials...</span>
                      </>
                    ) : (
                      <span>Generate {bulkSerialPreviewCount > 0 ? bulkSerialPreviewCount : ""} Serials</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* CONFIRM MODALS */}
        {/* ---------------------------------------------------------------- */}
        {/* Delete Godown */}
        <ConfirmModal
          isOpen={!!godownToDelete}
          title="Delete Godown"
          message={`Are you sure you want to delete godown "${godownToDelete?.name}"?`}
          confirmText="Delete Godown"
          confirmVariant="danger"
          loading={deletingGodown}
          onConfirm={handleConfirmDeleteGodown}
          onClose={() => setGodownToDelete(null)}
        />

        {/* Delete Single Rack */}
        <ConfirmModal
          isOpen={!!rackToDelete}
          title="Delete Rack"
          message={`Are you sure you want to delete rack "${rackToDelete?.rackNumber}"?`}
          confirmText="Delete Rack"
          confirmVariant="danger"
          loading={deletingRacks}
          onConfirm={handleConfirmDeleteSingleRack}
          onClose={() => setRackToDelete(null)}
        />

        {/* Delete Bulk Racks */}
        <ConfirmModal
          isOpen={isBulkDeleteRacksConfirm}
          title="Delete Selected Racks"
          message={`Are you sure you want to delete ${selectedRackIds.length} selected racks? This action cannot be undone.`}
          confirmText={`Delete ${selectedRackIds.length} Racks`}
          confirmVariant="danger"
          loading={deletingRacks}
          onConfirm={handleConfirmDeleteBulkRacks}
          onClose={() => setIsBulkDeleteRacksConfirm(false)}
        />

        {/* Delete Single Serial */}
        <ConfirmModal
          isOpen={!!serialToDelete}
          title="Delete Serial Number"
          message={`Are you sure you want to delete serial number "${serialToDelete?.serialNumber}"?`}
          confirmText="Delete Serial"
          confirmVariant="danger"
          loading={deletingSerials}
          onConfirm={handleConfirmDeleteSingleSerial}
          onClose={() => setSerialToDelete(null)}
        />

        {/* Delete Bulk Serials */}
        <ConfirmModal
          isOpen={isBulkDeleteSerialsConfirm}
          title="Delete Selected Serial Numbers"
          message={`Are you sure you want to delete ${selectedSerialIds.length} selected serial numbers? This action cannot be undone.`}
          confirmText={`Delete ${selectedSerialIds.length} Serials`}
          confirmVariant="danger"
          loading={deletingSerials}
          onConfirm={handleConfirmDeleteBulkSerials}
          onClose={() => setIsBulkDeleteSerialsConfirm(false)}
        />
      </div>
    </SoftwareLayout>
  );
}
