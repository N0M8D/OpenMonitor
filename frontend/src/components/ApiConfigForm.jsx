import React from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Reusable API configuration form section.
 *
 * Props:
 *   method / setMethod
 *   headers         — array of { key, value }
 *   setHeaders
 *   requestBody / setRequestBody
 *   expectedStatusCodes / setExpectedStatusCodes
 *   assertJsonPath / setAssertJsonPath
 *   assertJsonValue / setAssertJsonValue
 */
export default function ApiConfigForm({
    method, setMethod,
    headers, setHeaders,
    requestBody, setRequestBody,
    expectedStatusCodes, setExpectedStatusCodes,
    assertJsonPath, setAssertJsonPath,
    assertJsonValue, setAssertJsonValue,
}) {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes((method || 'GET').toUpperCase());

    function addHeader() {
        setHeaders([...headers, { key: '', value: '' }]);
    }

    function removeHeader(idx) {
        setHeaders(headers.filter((_, i) => i !== idx));
    }

    function updateHeader(idx, field, val) {
        setHeaders(headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h)));
    }

    return (
        <div className="api-config">
            {/* ── Method ────────────────────────────────────────────────── */}
            <div className="api-config-title">Request configuration</div>

            <div className="form-group">
                <label className="form-label">Method</label>
                <select
                    className="form-select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                >
                    {METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            {/* ── Headers ───────────────────────────────────────────────── */}
            <div className="form-group">
                <label className="form-label">Headers</label>
                <div className="api-headers">
                    {headers.map((h, i) => (
                        <div key={i} className="api-header-row">
                            <input
                                className="form-input form-input--sm"
                                placeholder="Key"
                                value={h.key}
                                onChange={(e) => updateHeader(i, 'key', e.target.value)}
                            />
                            <input
                                className="form-input form-input--sm"
                                placeholder="Value"
                                value={h.value}
                                onChange={(e) => updateHeader(i, 'value', e.target.value)}
                            />
                            <button
                                type="button"
                                className="btn-remove-header"
                                onClick={() => removeHeader(i)}
                                title="Remove header"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <button type="button" className="btn-add-header" onClick={addHeader}>
                        + Add header
                    </button>
                </div>
            </div>

            {/* ── Body (non-GET/HEAD only) ───────────────────────────────── */}
            {hasBody && (
                <div className="form-group">
                    <label className="form-label">Request body</label>
                    <textarea
                        className="form-textarea"
                        rows={4}
                        placeholder='{"key": "value"}'
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                    />
                </div>
            )}

            {/* ── Expected status codes ─────────────────────────────────── */}
            <div className="form-group">
                <label className="form-label">Expected status codes</label>
                <input
                    className="form-input"
                    placeholder="200, 201  (leave empty for any 2xx/3xx)"
                    value={expectedStatusCodes}
                    onChange={(e) => setExpectedStatusCodes(e.target.value)}
                />
            </div>

            {/* ── JSON assertion ────────────────────────────────────────── */}
            <div className="api-assert-section">
                <div className="api-config-title">JSON response assertion <span className="optional-label">(optional)</span></div>
                <div className="api-assert-row">
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">JSON path</label>
                        <input
                            className="form-input"
                            placeholder="data.status"
                            value={assertJsonPath}
                            onChange={(e) => setAssertJsonPath(e.target.value)}
                        />
                    </div>
                    <div className="api-assert-eq">=</div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Expected value</label>
                        <input
                            className="form-input"
                            placeholder="ok"
                            value={assertJsonValue}
                            onChange={(e) => setAssertJsonValue(e.target.value)}
                        />
                    </div>
                </div>
                <p className="api-assert-hint">
                    Dot-notation path into the JSON response body, e.g. <code>data.status</code> → must equal <code>ok</code>.
                </p>
            </div>
        </div>
    );
}
