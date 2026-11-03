import { Link } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { StatusBadge, TypeBadge } from "../ui/Badge";
import { reasonLabel } from "../../utils/labels";
import { formatDate, initials } from "../../utils/format";

function SortHeader({ label, field, sort, onSort }) {
  if (!onSort) return <th className="th">{label}</th>;
  const active = sort.replace("-", "") === field;
  const descending = sort.startsWith("-");
  const next = active && descending ? field : `-${field}`;
  return (
    <th className="th" aria-sort={active ? (descending ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className="inline-flex items-center gap-1 uppercase hover:text-slate-700"
      >
        {label}
        {active && (descending ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export default function RequestsTable({ items, linkTo, showCustomer = false, showAssignee = false, sort, onSort }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <SortHeader label="Request" field="id" sort={sort ?? ""} onSort={onSort} />
            <th className="th">Product</th>
            {showCustomer && <th className="th">Customer</th>}
            <th className="th">Reason</th>
            <SortHeader label="Status" field="status" sort={sort ?? ""} onSort={onSort} />
            {showAssignee && <th className="th">Assigned to</th>}
            <SortHeader label="Submitted" field="created_at" sort={sort ?? ""} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((r) => (
            <tr key={r.id} className="group relative hover:bg-slate-50">
              <td className="td whitespace-nowrap">
                <Link to={linkTo(r)} className="font-medium text-indigo-600 group-hover:text-indigo-500">
                  <span className="absolute inset-0" aria-hidden="true" />
                  {r.reference}
                </Link>
                <div className="mt-1">
                  <TypeBadge type={r.request_type} />
                </div>
              </td>
              <td className="td">
                <p className="font-medium text-slate-900">{r.product.name}</p>
                <p className="text-xs text-slate-500">
                  {r.order_number} · Qty {r.quantity}
                </p>
              </td>
              {showCustomer && (
                <td className="td">
                  <p className="text-slate-900">{r.customer.name}</p>
                  <p className="text-xs text-slate-500">{r.customer.email}</p>
                </td>
              )}
              <td className="td whitespace-nowrap">{reasonLabel(r.reason)}</td>
              <td className="td">
                <StatusBadge status={r.status} />
              </td>
              {showAssignee && (
                <td className="td whitespace-nowrap">
                  {r.assigned_employee ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                        {initials(r.assigned_employee.name)}
                      </span>
                      {r.assigned_employee.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
              )}
              <td className="td whitespace-nowrap text-slate-500">{formatDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
