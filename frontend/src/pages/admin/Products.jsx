import { useState } from "react";
import { Archive, ArchiveRestore, Package, Pencil, Plus, Search } from "lucide-react";
import { catalogApi } from "../../api";
import { errorMessage, fieldErrors } from "../../api/client";
import { useAsync, useDebouncedValue } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { TextArea, TextInput } from "../../components/ui/Form";
import { ConfirmDialog, Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, InlineError, TableSkeleton } from "../../components/ui/Feedback";
import { formatCurrency } from "../../utils/format";
import { validateProduct } from "../../utils/validation";

const EMPTY = { sku: "", name: "", category: "", description: "", price: "", warranty_days: "365" };

function ProductForm({ product, categories, onSaved, onClose }) {
  const toast = useToast();
  const isNew = !product;
  const [form, setForm] = useState(
    product ? { ...product, price: String(product.price), warranty_days: String(product.warranty_days) } : EMPTY,
  );
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = validateProduct(form, isNew);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setServerError("");
    const body = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: form.price,
      warranty_days: Number(form.warranty_days),
    };
    try {
      const saved = isNew
        ? await catalogApi.createProduct({ ...body, sku: form.sku.trim() })
        : await catalogApi.updateProduct(product.id, body);
      toast.success(isNew ? `${saved.name} added.` : "Product updated.");
      onSaved(saved);
    } catch (error) {
      setErrors(fieldErrors(error));
      setServerError(errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isNew ? "Add product" : `Edit ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {isNew ? "Add product" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate className="space-y-4">
        <InlineError>{serverError}</InlineError>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="SKU"
            required
            value={form.sku}
            onChange={update("sku")}
            error={errors.sku}
            disabled={!isNew}
            hint={isNew ? "Can't be changed later." : undefined}
          />
          <TextInput
            label="Category"
            required
            list="categories"
            value={form.category}
            onChange={update("category")}
            error={errors.category}
          />
        </div>
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextInput label="Name" required value={form.name} onChange={update("name")} error={errors.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Price (USD)"
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={update("price")}
            error={errors.price}
          />
          <TextInput
            label="Warranty (days)"
            required
            type="number"
            min="0"
            value={form.warranty_days}
            onChange={update("warranty_days")}
            error={errors.warranty_days}
            hint="0 means no warranty."
          />
        </div>
        <TextArea
          label="Description"
          rows={3}
          value={form.description}
          onChange={update("description")}
          error={errors.description}
        />
      </form>
    </Modal>
  );
}

export default function Products() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [archiving, setArchiving] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebouncedValue(query);

  const products = useAsync(
    () => catalogApi.products({ q, category, include_archived: showArchived }),
    [q, category, showArchived],
  );
  const categories = useAsync(() => catalogApi.categories(), []);

  const toggleArchive = async () => {
    setBusy(true);
    try {
      await catalogApi.updateProduct(archiving.id, { archived: !archiving.archived });
      toast.success(archiving.archived ? `${archiving.name} restored.` : `${archiving.name} archived.`);
      setArchiving(null);
      products.reload({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalog customers' purchases point to. Archived products stay on existing orders."
        actions={
          <Button icon={Plus} onClick={() => setEditing("new")}>
            Add product
          </Button>
        }
      />

      <Card bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search by name or SKU"
              aria-label="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input sm:w-48"
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {products.loading && !products.data ? (
          <TableSkeleton />
        ) : products.error ? (
          <ErrorState message={products.error} onRetry={products.reload} />
        ) : products.data.length === 0 ? (
          <EmptyState icon={Package} title="No products found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Price</th>
                  <th className="th">Warranty</th>
                  <th className="th">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products.data.map((p) => (
                  <tr key={p.id} className={p.archived ? "bg-slate-50/60" : ""}>
                    <td className="td">
                      <p className={`font-medium ${p.archived ? "text-slate-500" : "text-slate-900"}`}>{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.sku}
                        {p.archived && (
                          <Badge className="ml-2 bg-slate-100 text-slate-500 ring-slate-300">Archived</Badge>
                        )}
                      </p>
                    </td>
                    <td className="td">{p.category}</td>
                    <td className="td text-right tabular-nums">{formatCurrency(p.price)}</td>
                    <td className="td">{p.warranty_days ? `${p.warranty_days} days` : "None"}</td>
                    <td className="td text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => setEditing(p)}
                        aria-label={`Edit ${p.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={p.archived ? ArchiveRestore : Archive}
                        onClick={() => setArchiving(p)}
                        aria-label={`${p.archived ? "Restore" : "Archive"} ${p.name}`}
                      >
                        {p.archived ? "Restore" : "Archive"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            products.reload({ quiet: true });
            categories.reload({ quiet: true });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        title={archiving?.archived ? "Restore product?" : "Archive product?"}
        confirmLabel={archiving?.archived ? "Restore" : "Archive"}
        variant={archiving?.archived ? "primary" : "danger"}
        loading={busy}
        onConfirm={toggleArchive}
        onClose={() => setArchiving(null)}
      >
        <p>
          {archiving?.archived
            ? `${archiving?.name} will appear in the catalog again.`
            : `${archiving?.name} will be hidden from the catalog. Existing purchases and requests aren't affected.`}
        </p>
      </ConfirmDialog>
    </>
  );
}
