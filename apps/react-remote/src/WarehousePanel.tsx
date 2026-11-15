import { Button } from "@lab/ui/button";
import { Checkbox } from "@lab/ui/checkbox";
import { useState } from "react";
import "./styles.css";

export interface WarehousePanelProps {
  warehouse: string;
  openOrders: number;
  crash?: boolean;
}
export default function WarehousePanel({
  warehouse,
  openOrders,
  crash = false,
}: WarehousePanelProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  if (crash || failed)
    throw new Error("Intentional plain React render failure");
  return (
    <section className="warehouse-panel" data-testid="warehouse-panel">
      <header>
        <div>
          <span>PLAIN REACT REMOTE</span>
          <h2>Fulfillment checklist</h2>
        </div>
        <b>:3007</b>
      </header>
      <p>
        {warehouse} · <strong>{openOrders} open orders</strong>
      </p>
      <div className="warehouse-progress">
        <span style={{ width: `${(checked.length / 3) * 100}%` }} />
      </div>
      <p data-testid="checklist-progress">
        {checked.length} of 3 steps complete
      </p>
      {[
        "Print shipping labels",
        "Review packing slips",
        "Schedule collection",
      ].map((task) => (
        <label key={task}>
          <Checkbox
            checked={checked.includes(task)}
            onCheckedChange={(value) =>
              setChecked((old) =>
                value === true
                  ? [...old, task]
                  : old.filter((value) => value !== task),
              )
            }
          />
          {task}
        </label>
      ))}
      <details>
        <summary>Render fault check</summary>
        <Button variant="outline" onClick={() => setFailed(true)}>
          Simulate React crash
        </Button>
      </details>
    </section>
  );
}
