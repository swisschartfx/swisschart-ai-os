class OccurrenceSuppressionPolicy {
    evaluate() {
        return { suppressed: false, reason: null, reference: null };
    }
}

module.exports = OccurrenceSuppressionPolicy;
