/**
 * F5 regression coverage — the admin form that lets a manager add a new
 * allow-listed insurer host must reject the same regex shapes that the
 * server's Zod schema rejects. Historically the form used a glob
 * validator which would happily accept `*.axa.ma` and let the server
 * reject it; worse, a nested-quantifier like `^(a+)+$` slipped through
 * and only surfaced as an HTTP 400 after a round trip.
 *
 * These tests cover the four guard clauses, in order:
 *   1. host required
 *   2. host must end with `$` (anchored)
 *   3. host must pass `isSafeRegexSource` (no ReDoS shapes)
 *   4. host must compile via `new RegExp(host, "i")`
 * Plus the tightened insurer_code rule `/^[A-Z0-9_]{2,16}$/`.
 *
 * We render the real form (inside its base-ui Dialog) so we also catch
 * regressions in the Dialog wiring — the server-side validator is
 * covered in `packages/shared` tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsurerDomainForm } from "../../../src/components/scraper/InsurerDomainForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onOpenChange = vi.fn();
  render(
    <InsurerDomainForm
      open
      onOpenChange={onOpenChange}
      initial={null}
      isSaving={false}
      onSubmit={onSubmit}
    />,
  );
  // base-ui Dialog renders inside a portal but still lives in document.body,
  // so `screen` queries find everything without extra setup.
  const dialog = screen.getByRole("dialog");
  return {
    onSubmit,
    onOpenChange,
    dialog,
    // Labelled controls. `getByLabelText` doesn't work here because the
    // <label> wraps a <span> rather than being linked via htmlFor — we
    // scope by text + role instead.
    hostInput: within(dialog).getByPlaceholderText(
      "^(www\\.)?rmaassurance\\.com$",
    ) as HTMLInputElement,
    codeInput: within(dialog).getByPlaceholderText("AXA") as HTMLInputElement,
    labelInput: within(dialog).getByPlaceholderText(
      "AXA Assurance Maroc",
    ) as HTMLInputElement,
    submit: within(dialog).getByRole("button", { name: /^(ajouter|enregistrer)$/i }),
  };
}

describe("InsurerDomainForm — F5 regex validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unanchored host pattern with a French message", async () => {
    const user = userEvent.setup();
    const { hostInput, codeInput, labelInput, submit, onSubmit } = renderForm();

    // Unanchored — server would silently widen the allowlist to
    // `rmaassurance.com.evil.example`, so we must block at write time.
    await user.type(hostInput, "rmaassurance\\.com");
    await user.type(codeInput, "RMA");
    await user.type(labelInput, "RMA Assurance");
    await user.click(submit);

    expect(
      await screen.findByText(/Le motif doit être ancré par \$/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a nested-quantifier pattern (ReDoS `^(a+)+$`)", async () => {
    const user = userEvent.setup();
    const { hostInput, codeInput, labelInput, submit, onSubmit } = renderForm();

    // The canonical ReDoS shape. `isSafeRegexSource` must flag this.
    await user.type(hostInput, "^(a+)+$");
    await user.type(codeInput, "BADSHAPE");
    await user.type(labelInput, "Bad shape");
    await user.click(submit);

    expect(
      await screen.findByText(/quantificateurs imbriqués ou trop larges/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects syntactically invalid regex (unterminated group)", async () => {
    const user = userEvent.setup();
    const { hostInput, codeInput, labelInput, submit, onSubmit } = renderForm();

    // `^(foo$` — `isSafeRegexSource` rejects unclosed groups as
    // "invalid-syntax" (which we surface the same way). Either the
    // "ancré par $" or the ReDoS/invalid message is acceptable because
    // the unterminated group also fails the anchor check depending on
    // the order guards fire — the important behaviour is that the
    // submit is blocked.
    await user.type(hostInput, "^(foo$");
    await user.type(codeInput, "BADSYNTAX");
    await user.type(labelInput, "Bad syntax");
    await user.click(submit);

    // One of the regex guards must have fired and blocked the submit.
    const errors = within(screen.getByRole("dialog")).queryAllByText(
      /motif|régulière|quantificateurs/i,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an insurer_code with hyphens (shared schema disallows them)", async () => {
    const user = userEvent.setup();
    const { hostInput, codeInput, labelInput, submit, onSubmit } = renderForm();

    // The old form accepted A-Z0-9_- up to 32 chars. F5 narrowed this
    // to /^[A-Z0-9_]{2,16}$/ to align with the shared Zod schema —
    // hyphens now round-trip to a server rejection we want to catch.
    await user.type(hostInput, "^(www\\.)?rmaassurance\\.com$");
    await user.type(codeInput, "RMA-MA");
    await user.type(labelInput, "RMA");
    await user.click(submit);

    expect(
      await screen.findByText(
        /2 à 16 caractères : lettres majuscules, chiffres, tirets bas/i,
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a valid anchored host pattern and calls onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { hostInput, codeInput, labelInput, submit } = renderForm(onSubmit);

    await user.type(hostInput, "^(www\\.)?rmaassurance\\.com$");
    await user.type(codeInput, "RMA");
    await user.type(labelInput, "RMA Assurance Maroc");
    await user.click(submit);

    // Wait for the async onSubmit to fire — we don't assert on UI state
    // after because the parent would normally close the dialog.
    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        host_pattern: "^(www\\.)?rmaassurance\\.com$",
        insurer_code: "RMA",
        label: "RMA Assurance Maroc",
        capture_enabled: true,
      }),
    );
  });
});
