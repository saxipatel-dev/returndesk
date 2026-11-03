import { Card } from "../ui/Layout";
import { RESOLUTIONS, reasonLabel } from "../../utils/labels";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/format";

function Row({ label, children }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  );
}

export default function RequestOverview({ request, showCustomer = false }) {
  const value = Number(request.unit_price) * request.quantity;
  return (
    <Card title="Request details">
      <dl className="divide-y divide-slate-100">
        <Row label="Product">
          <span className="font-medium">{request.product.name}</span>
          <span className="text-slate-500"> · {request.product.sku}</span>
        </Row>
        <Row label="Order">
          {request.order_number} · purchased {formatDate(request.purchased_at)}
        </Row>
        {showCustomer && (
          <Row label="Customer">
            {request.customer.name} <span className="text-slate-500">({request.customer.email})</span>
          </Row>
        )}
        <Row label="Quantity">
          {request.quantity} of {request.purchased_quantity} purchased · {formatCurrency(value)}
        </Row>
        <Row label="Reason">{reasonLabel(request.reason)}</Row>
        <Row label="Requested outcome">{RESOLUTIONS[request.requested_resolution]}</Row>
        <Row label="Description">
          <p className="whitespace-pre-line">{request.description}</p>
        </Row>
        {request.decision && (
          <Row label="Decision">
            <span className={request.decision === "approved" ? "text-emerald-700" : "text-rose-700"}>
              {request.decision === "approved" ? "Approved" : "Rejected"}
            </span>
            <span className="text-slate-500"> on {formatDateTime(request.decided_at)}</span>
            {request.decision_reason && <p className="mt-1 text-slate-600">{request.decision_reason}</p>}
          </Row>
        )}
        {request.fulfillment_note && <Row label="Fulfillment">{request.fulfillment_note}</Row>}
      </dl>
    </Card>
  );
}
